var componentName = 'multiWellHistogram';
module.exports.name = componentName;
require('./style.less');

const _DECIMAL_LEN = 4;

var app = angular.module(componentName, [
    'sideBar', 'wiTreeViewVirtual', 'wiTableView',
    'wiApi', 'editable', 'wiDialog',
    'wiDroppable', 'wiDropdownList','plot-toolkit','wiLoading','angularResizable','wiDiscriminator'
]);
app.component(componentName, {
    template: require('./template.html'),
    controller: multiWellHistogramController,
    controllerAs: 'self',
    bindings: {
        token: "<",
        idProject: "<",
        wellSpec: "<",
        zonesetName: "<",
        selectionType: "=",
        selectionValue: "=",
        idHistogram: "<",
        config: '<',
        noStack: '<',
        onSave: '<',
        onSaveAs: '<',
        title: '<',
        silent: "<", 
        ctrlParams: "<",
        cpGetMarkerVal: "<",
        cpSetMarkerVal: "<",
        cpMarkerStyle: "<",
        cpMarkerName: "<",
        prefix: '<',
        cpIcons: "<",
        cpIconStyle: "<"
    },
    transclude: true
});

function multiWellHistogramController($scope, $timeout, $element, wiToken, wiApi, wiDialog, wiLoading) {
    let self = this;
    self.silent = true;
    self.treeConfig = [];
    self.selectedNode = null;
    self.datasets = {};
    self.statisticHeaders = ['X-Axis','Filter','Top','Bottom','Points','Avg','Min', 'Max', 'Avgdev', 'Stddev', 'Var', 'Skew', 'Kurtosis', 'Median', 'P10', 'P50', 'P90'];
    self.statisticHeaderMasks = [true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true];
    //--------------
    $scope.tab = 1;
    self.selectionTab = self.selectionTab || 'Wells';

    $scope.setTab = function(newTab){
        $scope.tab = newTab;
    };

    $scope.isSet = function(tabNum){
        return $scope.tab === tabNum;
    };

    this.getFamilyTable = function() {
        return wiApi.getFamilyTable();
    }
    this.discriminatorDialog = function(well) {
        let wSpec = getWellSpec(well);
        let datasetId = wSpec.idDataset;
        let dataset = well.datasets.find(ds => ds.idDataset === wSpec.idDataset);

        let curvesArr = dataset.curves.map( c => ({type:'curve',name:c.name}) );
        wiDialog.discriminator(wSpec.discriminator, curvesArr, function(discrmnt) {
            wSpec.discriminator = discrmnt;
        });
    }
    this.hasDiscriminator = function(well) {
        let wSpec = getWellSpec(well);
        return Object.keys(((wSpec || {}).discriminator) || {}).length > 0 && wSpec.discriminator.active;
    }
    //--------------
    this.getDataset = function(well) {
        wiApi.getCachedWellPromise(well.idWell).then((well) => {
            self.datasets[well] = well.datasets;
        }).catch(e => console.error(e));
    }

    function getCurvesInWell(well) {
        let curves = [];
        well.datasets.forEach(dataset => {
            curves.push(...dataset.curves);
        });
        return curves;
    }

    function getFamilyInWell(well) {
        let curves = getCurvesInWell(well);
        let familyList = curves.map(c => wiApi.getFamily(c.idFamily));
        return familyList;
    }
    this.$onInit = async function () {
        if (self.token)
            wiToken.setToken(self.token);
        $timeout(() => {
            $scope.$watch(() => self.getFamilyTable(), () => {
                getSelectionList(self.selectionType, self.treeConfig);
                updateDefaultConfig();
            });
            $scope.$watch(() => (self.selectionType), () => {
                getSelectionList(self.selectionType, self.treeConfig);
                updateDefaultConfig();
            });
            $scope.$watch(() => (self.selectionValue), () => {
                updateDefaultConfig();
            });
            $scope.$watch(() => (self.treeConfig.map(w => w.idWell)), () => {
                getSelectionList(self.selectionType, self.treeConfig);
                getZonesetsFromWells(self.treeConfig);
                updateDefaultConfig();
            }, true);
        }, 500);

        self.cpGetMarkerVal = self.cpGetMarkerVal || function (marker, idx) { return  marker.value }
        self.cpSetMarkerVal = self.cpSetMarkerVal || function (marker, idx, newVal) {marker.value = newVal;}
        self.cpMarkerStyle = self.cpMarkerStyle || function (marker, idx) { return  {stroke:marker.color,'stroke-width':'2', fill:'none'} }
        self.cpMarkerName = self.cpMarkerName || function(marker, idx) { return  marker.name; }
        self.ctrlParams = self.ctrlParams || [];
        self.notCPBackground = self.ctrlParams.length ? false : true;
        self.ctrlParamsMask = self.ctrlParams.map(c => true);
        self.cpIcon = self.cpIcon || function(node) {
            let idx = self.ctrlParams.indexOf(node);
            if (idx >= 0) {
                let use = self.ctrlParamsMask[idx];
                return use ? 'layer-16x16': 'fa fa-eye-slash';
            }
        }
        self.cpIcons = self.cpIcons || function (node){ return ["rectangle"] }
        self.cpIconStyle = self.cpIconStyle || function(node) { 
            return  {
                'background-color': node.color || 'red'
            }
        }
        self.cpBackground = self.cpBackground || {
            'background-color': 'rgba(255, 249, 160, 0.6)'
        };


        self.defaultConfig = self.defaultConfig || {};
        self.wellSpec = self.wellSpec || [];
        getTrees();
        self.selectionType = self.selectionType || 'family-group';
        self.zoneTree = [];
        self.zonesetName = self.zonesetName || "ZonationAll";
        self.config = self.config || {grid:true, displayMode: 'bar', colorMode: 'zone', stackMode: self.noStack ? 'none':'well', binGap: 5, title: self.title || '', notShowCumulative: false};
        self.getToggleGaussianFn = self.config.notUsedGaussian ? self.click2ToggleLogNormalD : self.click2ToggleGaussian;
        self.getGaussianIconFn = self.config.notUsedGaussian ? self.getLogNormalDIcon : self.getGaussianIcon;
    }

    this.onInputSelectionChanged = function(selectedItemProps) {
        self.selectionValue = (selectedItemProps || {}).name;
    }

    function getSelectionList(selectionType, wellArray) {
        let selectionHash = {};
        let allCurves = [];
        wellArray.forEach(well => {
            let curvesInWell = getCurvesInWell(well);
            allCurves.push(...curvesInWell);
        });
        switch(selectionType) {
            case 'curve':
                allCurves.forEach(curve => {
                    selectionHash[curve.name] = 1;
                })
                break;
            case 'family': 
                allCurves.forEach(curve => {
                    let family = wiApi.getFamily(curve.idFamily);
                    if(family)
                        selectionHash[family.name] = 1;
                })
                break;
            case 'family-group':
                allCurves.forEach(curve => {
                    let family = wiApi.getFamily(curve.idFamily);
                    if(family)
                        selectionHash[family.familyGroup] = 1;
                })
                break;
        }
        self.selectionList = Object.keys(selectionHash).map(item => ({ 
            data:{label:item}, 
            properties:{name:item} 
        }));
    }

    this.runMatch = function (node, criteria) {
        let family;
        if (!criteria) return true;
        switch(self.selectionType) {
            case 'family-group': 
                family = wiApi.getFamily(node.idFamily);
                if (!family) return null;
                return family.familyGroup.trim().toLowerCase() === criteria.trim().toLowerCase();

            case 'family': 
                family = wiApi.getFamily(node.idFamily);
                if (!family) return null;
                return family.name.trim().toLowerCase() === criteria.trim().toLowerCase();

            case 'curve':
                return node.name.trim().toLowerCase() === criteria.trim().toLowerCase();
        }
    }
    this.getLabel = function (node) {
        return node.name;
    }
    this.getIcon = function (node) {
        if (node.idCurve) return 'curve-16x16';
        if (node.idDataset) return 'curve-data-16x16';
        if (node.idWell) return 'well-16x16';
    }
    this.getChildren = function (node) {
        if (node.idDataset) {
            return node.curves;
        }
        if (node.idWell) {
            return node.datasets;
        }
        return [];
    }
    this.clickFunction = clickFunction;
    function clickFunction($event, node, selectedObjs, treeRoot) {
        let wellSpec = self.wellSpec.find(wsp => wsp.idWell === treeRoot.idWell && wsp._idx === treeRoot._idx);
        wellSpec.idCurve = node.idCurve;
        wellSpec.idDataset = node.idDataset;
        wellSpec.curveName = node.Name;
    }
    this.refresh = function(){
        // self.histogramList.length = 0;
        // self.treeConfig.length = 0;
        getTrees(()=> {
            self.genHistogramList();
        });

    };
    async function getTree(wellSpec, callback) {
        let wellIdx = self.treeConfig.findIndex(wellTree => wellTree.idWell === wellSpec.idWell && wellTree._idx === wellSpec._idx);
        let well = await wiApi.getCachedWellPromise(wellSpec.idWell);
        well = Object.assign({}, well);
        well._idx = wellSpec._idx;
        $timeout(() => {
            self.treeConfig.push(well);
        })
        return well;
    }
    async function getTrees(callback) {
        wiLoading.show($element.find('.main')[0], self.silent);
        self.treeConfig = [];
        for (let w of self.wellSpec) {
            try {
                let well = await wiApi.getCachedWellPromise(w.idWell || w);
                well = Object.assign({}, well);
                well._idx = w._idx;
                self.treeConfig.push(well);
            }
            catch(e) {
                console.error(e);
            }
        }
        if (!$scope.$root.$$phase) $scope.$digest();

        callback && callback();
        wiLoading.hide();
    }
    function getZonesetsFromWells(wells) {
        if (!wells.length) return;
        let zsList;
        for (let well of wells) {
            let zonesets = well.zone_sets;
            if (!zsList) {
                zsList = angular.copy(zonesets);
            }
            else if (zsList.length) {
                zsList = intersectAndMerge(zsList, zonesets);
            }
            else {
                break;
            }
        }
        self.zonesetList = (zsList || []).map( zs => ({
            data: {
                label: zs.name
            },
            properties: zs
        }));
        self.zonesetList.splice(0, 0, {data: {label: 'ZonationAll'}, properties: genZonationAllZS(0, 1)});
        let selectedZonesetProps = (self.zonesetList.find(zs => zs.properties.name === self.zonesetName) || {}).properties;
        if (!selectedZonesetProps) return;
        self.onZonesetSelectionChanged(selectedZonesetProps);
        if (!$scope.$root.$$phase) $scope.$digest();
    }
    function intersectAndMerge(dstZoneList, srcZoneList) {
        return dstZoneList.filter(zs => {
            let zoneset = srcZoneList.find(zs1 => zs.name === zs1.name);
            if (!zoneset) return false;
            for (let z of zoneset.zones) {
                let zone = zs.zones.find(zo => zo.zone_template.name == z.zone_template.name);
                if (!zone) {
                    zs.zones.push(angular.copy(z));
                }
            }
            return true;
        });
    }
    this.getWellSpec = getWellSpec;
    function getWellSpec(well) {
        if (!well) return {};
        return self.wellSpec.find(wsp => wsp.idWell === well.idWell && wsp._idx === well._idx);
    }
    this.getCurve = getCurve;
    function getCurve(well) {
        let wellSpec = getWellSpec(well);
        if (!Object.keys(wellSpec || {}).length) return {};
        let curves = getCurvesInWell(well).filter(c => self.runMatch(c, self.selectionValue));
        let curve = wellSpec.idCurve ? curves.find(c => c.idCurve === wellSpec.idCurve) || curves[0] : curves[0];
        if (!curve) {
            delete wellSpec.curveName;
            delete wellSpec.idCurve;
            delete wellSpec.idDataset;
            delete wellSpec.datasetName;
            delete wellSpec.datasetTop;
            delete wellSpec.datasetBottom;
            delete wellSpec.datasetStep;
            return;
        }
        wellSpec.curveName = curve.name;
        wellSpec.idCurve = curve.idCurve;
        wellSpec.idDataset = curve.idDataset;

        let datasets = self.getChildren(well);
        let dataset = wellSpec.idDataset ? datasets.find(ds => ds.idDataset === wellSpec.idDataset):datasets[0];
        wellSpec.datasetName = dataset.name;
        wellSpec.datasetTop = parseFloat(dataset.top);
        wellSpec.datasetBottom = parseFloat(dataset.bottom);
        wellSpec.datasetStep = parseFloat(dataset.step);
        return curve;
    }
    function getZoneset(well, zonesetName = "") {
        let zonesets = well.zone_sets;
        if (zonesetName === "" || zonesetName === "ZonationAll") 
            return null;
        return zonesets.find(zs => zs.name === zonesetName);
    }
    this.onZonesetDropdownInit = function(wiDropdownListCtrl) {
        self.zonesetDropdownCtrl = wiDropdownListCtrl;
    }
    this.onZonesetSelectionChanged = function(selectedItemProps) {
        wiApi.indexZonesForCorrelation((selectedItemProps || {}).zones)
        self.zoneTree = (selectedItemProps || {}).zones;
        if (!self.zoneTree || !self.zoneTree.length) return;
        self.zoneTreeUniq = _.uniqBy(self.zoneTree.map(zone => ({name: zone.zone_template.name})), zone => {
            return zone.name;
        });
        self.zonesetName = (selectedItemProps || {}).name || 'ZonationAll';
    }
    this.runZoneMatch = function (node, criteria) {
        let keySearch = criteria.toLowerCase();
        let searchArray = node.zone_template.name.toLowerCase();
        return searchArray.includes(keySearch);
    }
    this.getZoneLabel = function (node) {
        if(!node || !node.name){
            return 'aaa';
        }
        //return node.zone_template.name;
        return node.name;
    }

    this.getZoneIcon = (node) => ( (node && !node._notUsed) ? 'zone-16x16': 'fa fa-ban' )
    const EMPTY_ARRAY = []
    this.validPlotRegion = function() {
        let result = (self.getRight() - self.getLeft());
        return _.isFinite(result) && result != 0;
    }
    this.noChildren = function (node) {
        return EMPTY_ARRAY;
    }
    this.click2ToggleZone = function ($event, node, selectedObjs) {
        node._notUsed = !node._notUsed;
        let zoneTree = self.zoneTree.filter(zone => zone.zone_template.name == node.name);
        zoneTree.forEach(zone => {
            zone._notUsed = !zone._notUsed;
        })
        self.selectedZones = selectedObjs;
    }
    this.getZoneTreeMaxHeight = function() {
        return $element.height();
    }

    this.click2ToggleLayer = function ($event, node, selectedObjs) {
        node._notUsed = !node._notUsed;
        self.selectedLayers = selectedObjs;
    }
    this.click2ToggleCumulative = function ($event, node, selectedObjs) {
        node._useCmlt = !node._useCmlt;
        self.setCumulativeData(self.histogramList);
    }
    this.click2ToggleGaussian = function ($event, node, selectedObjs) {
        node._useGssn = !node._useGssn;
        if (self.config.notUsedGaussian) {
            self.setLogNormalDFn(self.histogramList);
        } else {
            self.setGaussianData(self.histogramList);
        }
        self.setCumulativeData(self.histogramList);
        self.selectedGaussian = selectedObjs;
    }
    this.click2ToggleCtrlParams = function ($event, node, selectedObjs) {
        let ctrlParamIdx = self.ctrlParams.findIndex(cp => node.$res.name === cp.$res.name && node.zoneInfo.idZone == cp.zoneInfo.idZone);
        if (ctrlParamIdx >= 0) {
            self.ctrlParamsMask[ctrlParamIdx] = !self.ctrlParamsMask[ctrlParamIdx];
            self.selectedCtrlParams = selectedObjs;
        }
        self.selectedCtrlParams = selectedObjs;
    }
    this.click2ToggleLogNormalD = function ($event, node, selectedObjs) {
        node._useLogNormalD = !node._useLogNormalD;
        self.setLogNormalDFn(self.histogramList);
    }
    this.toggleGaussianLine = function(notUsedGaussian) {
        self.config.notUsedGaussian = notUsedGaussian;
        if (notUsedGaussian) {
            self.getToggleGaussianFn = self.click2ToggleLogNormalD;
            self.getGaussianIconFn = self.getLogNormalDIcon;
            self.setLogNormalDFn(self.histogramList);
        } else {
            self.getToggleGaussianFn = self.click2ToggleGaussian;
            self.getGaussianIconFn = self.getGaussianIcon;
            self.setGaussianData(self.histogramList);
        }
    }

    this.runCPMatch = function (node, criteria) {
        let keySearch = criteria.toLowerCase();
        let searchArray = self.cpMarkerName(node).toLowerCase();
        return searchArray.includes(keySearch);
    }
    this.runLayerMatch = function (node, criteria) {
        let keySearch = criteria.toLowerCase();
        let searchArray = node.name.toLowerCase();
        return searchArray.includes(keySearch);
    }
    let _layerTree = [];
    this.getLayerTree = function() {
        //if(self.getStackMode() === 'all') {
            //_layerTree[0] = self.histogramList;
            //return _layerTree;
        //}
        return self.histogramList;
    }
    this.getLayerLabel = (node) => node.name
    this.getLayerIcon = (node) => ( (node && !node._notUsed) ? 'layer-16x16': 'fa fa-eye-slash' )
    this.getLayerIcons = (node) => ( ["rectangle"] )
    this.getLayerIconStyle = (node) => ( {
        'background-color': node.color
    })
    this.getCumulativeIcon = (node) => ( (node && node._useCmlt) ? 'layer-16x16': 'fa fa-eye-slash' )
    this.getCumulativeIcons = (node) => ( ["rectangle"] )
    this.getCumulativeIconStyle = (node) => ( {
        'background-color': node.color
    })
    /*
    this.getCtrlParamsIcon = function(node) {
        let idx = self.ctrlParams.indexOf(node);
        if (idx >= 0) {
            let use = self.ctrlParamsMask[idx];
            return use ? 'layer-16x16': 'fa fa-eye-slash';
        }
    }
    this.getCtrlParamsIcons = function (node){ return ["rectangle"] }
    this.getCtrlParamsIconStyle = function(node) { 
        return  {
            'background-color': self.cpMarkerStyle(node).color
        }
    }*/
    this.getGaussianIcon = function(node) {
        return (node && node._useGssn) ? 'layer-16x16': 'fa fa-eye-slash';
    }
    this.getLogNormalDIcon = function(node) {
        return (node && node._useLogNormalD) ? 'layer-16x16': 'fa fa-eye-slash';
    }
    this.getGaussianIcons = (node) => ( ["rectangle"] )
    this.getGaussianIconStyle = (node) => ( {
        'background-color': node.color
    } )
    this.getConfigLeft = function() {
        self.config = self.config || {};
        return isNaN(self.config.left) ? "[empty]": wiApi.bestNumberFormat(self.config.left, 3);
    }
    this.getConfigLimitTop = function () {
        self.config = self.config || {};
        return isNaN(self.config.limitTop) ? "[empty]": wiApi.bestNumberFormat(self.config.limitTop, 3);
    }
    this.getConfigLimitBottom = function () {
        self.config = self.config || {};
        return isNaN(self.config.limitBottom) ? "[empty]": wiApi.bestNumberFormat(self.config.limitBottom, 3);
    }
    this.setConfigLimitTop = function (notUse, newValue) {
        self.config.limitTop = parseFloat(newValue)
    }
    this.setConfigLimitBottom = function (notUse, newValue) {
        self.config.limitBottom = parseFloat(newValue)
    }
    this.setConfigLeft = function(notUse, newValue) {
        self.config.left = parseFloat(newValue);
    }
    this.getConfigRight = function() {
        self.config = self.config || {};
        return isNaN(self.config.right) ? "[empty]": wiApi.bestNumberFormat(self.config.right, 3);
    }
    this.setConfigRight = function(notUse, newValue) {
        self.config.right = parseFloat(newValue);
    }
    this.getConfigDivisions = function() {
        self.config = self.config || {};
        return isNaN(self.config.divisions) ? "[empty]": self.config.divisions;
    }
    this.setConfigDivisions = function(notUse, newValue) {
        self.config.divisions = parseInt(newValue);
    }
    this.getConfigTitle = function() {
        self.config = self.config || {};
        return (self.config.title || "").length ? self.config.title : "New Histogram";
    }
    this.setConfigTitle = function(notUse, newValue) {
        self.config.title = newValue;
    }
    this.getConfigXLabel = function() {
        self.config = self.config || {};
        return (self.config.xLabel || "").length ? self.config.xLabel : self.selectionValue;
    }
    this.setConfigXLabel = function(notUse, newValue) {
        self.config.xLabel = newValue;
    }
    function clearDefaultConfig() {
        self.defaultConfig = {};
    }
    function updateDefaultConfig() {
        clearDefaultConfig();
        let curve = getCurve(self.treeConfig[0], self.wellSpec[0]);
        if (!curve) return;
        let family = wiApi.getFamily(curve.idFamily);
        if (!family) return;
        $timeout(() => {
            self.defaultConfig.left = family.family_spec[0].minScale;
            self.defaultConfig.right = family.family_spec[0].maxScale;
            self.config.left = family.family_spec[0].minScale || 0;
            self.config.right = family.family_spec[0].maxScale || 100;
            self.config.loga = family.family_spec[0].displayType.toLowerCase() === 'logarithmic';
        })
    }

    this.histogramList = [];
    var flattenHistogramList = [];
    var listWellStats = [];
    var listAllStats = [];
    this.genHistogramList = async function() {
        let preLayers = self.histogramList.map(layer => layer.name);
        //console.log(layer.name)
        this.histogramList.length = 0;
        let allHistogramList = []
        listWellStats.length = 0;
        listAllStats.length = 0;
        _histogramGen = null;
        wiLoading.show($element.find('.main')[0], self.silent);

        let allZones = [];
        let allDataArray = [];
        let zoneBinsList = [];
        try {
            for (let i = 0; i < self.treeConfig.length; i++) {
                let well = self.treeConfig[i];
                let wellSpec = getWellSpec(well);
                if (well._notUsed) {
                    continue;
                }
                let curve = getCurve(well, self.wellSpec[i]);
                if (!curve) {
                    continue;
                }
                let datasetTop = self.wellSpec[i].datasetTop;
                let datasetBottom = self.wellSpec[i].datasetBottom;
                let datasetStep = self.wellSpec[i].datasetStep;
                let dataset = well.datasets.find(ds => ds.idDataset === self.wellSpec[i].idDataset);

                let zoneset = getZoneset(well, self.zonesetName);
                zoneset = zoneset || genZonationAllZS(datasetTop, datasetBottom, well.color);

                let curveData = await wiApi.getCachedCurveDataPromise(curve.idCurve);
                if (self.hasDiscriminator(well)) {
                    let discriminatorCurve = await wiApi.evalDiscriminatorPromise(dataset, self.wellSpec[i].discriminator);
                    curveData = curveData.filter((d, idx) => discriminatorCurve[idx]);
                }
                curveData = curveData
                    .filter(d => _.isFinite(d.x))
                    .map(d => ({
                        ...d, 
                        depth: datasetStep>0?(datasetTop + d.y * datasetStep):d.y
                    }));
                let zones = zoneset.zones.filter(zone => {
                    let z = self.zoneTree.find(z1 => {
                        return z1.zone_template.name === zone.zone_template.name
                    });
                    return !z._notUsed;
                });
                wiApi.indexZonesForCorrelation(zones);

                if (self.getStackMode() === 'all') {
                    allZones = [...allZones, ...zones];
                }
                let wellHistogramList = [];
                let wellDataArray = [];
                for (let j = 0; j < zones.length; j++) {
                    let zone = zones[j];
                    let dataArray = filterData(curveData, zone);
                    dataArray.top = zone.startDepth;
                    dataArray.bottom = zone.endDepth;
                    if (self.getStackMode() === 'well') {
                        wellDataArray = [...wellDataArray, ...dataArray];
                    } else if (self.getStackMode() === 'all') {
                        allDataArray = [...allDataArray, ...dataArray];
                    }
                    let bins = genBins(dataArray);
                    bins.color = self.getColor(zone, well);
                    bins.name = `${well.name}.${zone.zone_template.name}:${zone._idx}`;

                    bins.stats = {};
                    switch (self.getStackMode()) {
                        case 'none':
                            bins.stats.curveInfo = `${curve.name}`;
                            break;
                        case 'all':
                            bins.stats.curveInfo = `${well.name}.${curve.name}`;
                            break;
                    }
                    bins.stats.conditionExpr = wellSpec.discriminator ? wellSpec.discriminator.conditionExpr : undefined;
                    bins.stats.top = zone.startDepth;
                    bins.stats.bottom = zone.endDepth;
                    let stats = setStats(dataArray.map(d => d.x));
                    Object.assign(bins.stats, stats);
                    if (self.getStackMode() === 'zone') {
                        let zoneExisted = zoneBinsList.find(zbl => zbl.name == zone.zone_template.name);
                        let zoneBinsElem;
                        if (!zoneExisted) {
                            zoneBinsList.push([]);
                            zoneExisted = zoneBinsList[zoneBinsList.length - 1];
                            zoneExisted.name = `${zone.zone_template.name}:${zone._idx}`;
                            if (self.getColorMode() === 'zone') {
                                zoneExisted.color = self.getColor(zone, well);
                            } else {
                                zoneExisted.color = well.color;
                            }
                        }
                        //if (!zoneExisted[i]) zoneExisted[i] = [];
                        //zoneExisted[i] = bins;
                        zoneExisted.push(bins);
                    }
                    wellHistogramList.push(bins);
                }
                if (self.getStackMode() === 'well') {
                    let stats = setStats(wellDataArray.map(d => d.x));
                    stats.top = d3.min(zones, z => z.startDepth);
                    stats.bottom = d3.max(zones, z => z.endDepth);
                    stats.curveInfo = `${curve.name}`;
                    stats.conditionExpr = wellSpec.discriminator ? wellSpec.discriminator.conditionExpr : undefined;
                    listWellStats.push(stats);
                    wellHistogramList.name = well.name;
                    wellHistogramList.color = well.color;
                    allHistogramList.push(wellHistogramList);
                } else allHistogramList.push(...wellHistogramList);
            }
            allHistogramList.name = 'All';
            let max = 0;
            let flatten = [];
            switch(self.getStackMode()) {
                case 'none':
                    for (let bins of allHistogramList) {
                        let maybeMax = d3.max(bins.map(b => b.length));
                        max = (max > maybeMax) ? max : maybeMax;
                    }
                    flatten = allHistogramList;
                    break;
                case 'well':
                    {
                        for (let groupOfBins of allHistogramList) {
                            let aggregate = aggregateHistogramList(groupOfBins);
                            let maybeMax = d3.max(aggregate);
                            max = (max > maybeMax) ? max : maybeMax;
                            flatten = flatten.concat(groupOfBins);
                        }
                    }
                    break;
                case 'zone':
                    {
                        for (let groupOfBins of zoneBinsList) {
                            let fullData = [];
                            for (let i = 0; i < groupOfBins.flat().length; i++) {
                                fullData = fullData.concat(groupOfBins.flat()[i]);
                            }
                            groupOfBins.stats = setStats(fullData);
                            groupOfBins.stats.top = _.min(groupOfBins.map(gob => gob.stats.top));
                            groupOfBins.stats.bottom = _.max(groupOfBins.map(gob => gob.stats.bottom));
                            let aggregate = aggregateHistogramList(groupOfBins);
                            let maybeMax = d3.max(aggregate);
                            max = (max > maybeMax) ? max : maybeMax;
                        }
                        allHistogramList = zoneBinsList;
                        flatten = zoneBinsList;
                    }
                    break;
                case 'all': 
                    {
                        let aggregate = aggregateHistogramList(allHistogramList);
                        max = d3.max(aggregate);
                        flatten = allHistogramList;
                        let stats = setStats(allDataArray.map(d => d.x));
                        stats.top = d3.min(allZones, z => z.startDepth);
                        stats.bottom = d3.max(allZones, z => z.endDepth);
                        listAllStats.push(stats);
                    }
                    break;
            }
            $timeout(() => {
                self.minY = 0;
                self.maxY = max;
                if (self.getStackMode() == 'all') {
                    self.histogramList = [allHistogramList];
                } else {
                    self.histogramList = allHistogramList;
                }
                flattenHistogramList = flatten;
                self.setCumulativeData(self.histogramList);
                self.setGaussianData(self.histogramList);
            });
        }
        catch(e) {
            console.error(e);
        }
        wiLoading.hide();
    }
    function setStats(dataArray) {
        let stats = {};
        try {
            stats.numPoints = dataArray.length;
            stats.avg = d3.mean(dataArray);
            stats.min = d3.min(dataArray);
            stats.max = d3.max(dataArray);
            stats.stddev = d3.deviation(dataArray);
            stats.avgdev = calAverageDeviation(dataArray);
            stats.var = d3.variance(dataArray);
            stats.median = d3.median(dataArray);
            stats.skew = dataArray.length >= 3 ? ss.sampleSkewness(dataArray) : undefined;
            stats.kurtosis = dataArray.length >= 4 ? ss.sampleKurtosis(dataArray) : undefined;
            stats.p10 = calPercentile(dataArray, 0.1);
            stats.p50 = calPercentile(dataArray, 0.5);
            stats.p90 = calPercentile(dataArray, 0.9);
        }
        catch(e) {
            console.error(e);
        }
        return stats;
    }
    function calAverageDeviation(data) {
        if (data.length < 1) return;
        let mean = d3.mean(data);

        return d3.mean(data, function (d) {
            return Math.abs(d - mean)
        }).toFixed(_DECIMAL_LEN);
    }
    function calPercentile(data, p) {
        if (data.length < 1) return;
        return d3.quantile(data.sort(function (a, b) {
            return a - b;
        }), p).toFixed(_DECIMAL_LEN);
    }
    function aggregateHistogramList(histogramList) {
        let aggregate = [];
        for (let bins of histogramList) {
            for (let j = 0; j < bins.length; j++) {
                aggregate[j] = ((aggregate[j] || 0) + bins[j].length);
            }
        }
        return aggregate;
    }
    function genZonationAllZS(top, bottom, color = 'blue') {
        return {
            name: 'ZonationAll',
            zones: [{
                startDepth: top,
                endDepth: bottom,
                zone_template: {
                    name: 'ZonationAll',
                    background: color
                }
            }]
        }
    }
    this.genBins = genBins;
    function genBins(pointset) {
        let divisions = self.getDivisions();
        let loga = self.getLoga();
        let histogramGen = getHistogramFn(divisions, loga);
        return histogramGen(pointset.map(d => d.x));
    }
    var _histogramGen;
    function getHistogramFn(divisions, loga) {
        if (!_histogramGen) {
            let left = self.getLeft();
            let right = self.getRight();
            let divisions = self.getDivisions();
            let domain = d3.extent([left, right]);
            let thresholds;
            if (!loga) {
                thresholds = d3.range(domain[0], domain[1], (domain[1] - domain[0])/divisions);
            }
            else {
                let logMinVal = Math.log10(domain[0] || 0.01);
                let logMaxVal = Math.log10(domain[1] || 0.01);
                thresholds = d3.range(logMinVal, logMaxVal, (logMaxVal - logMinVal)/divisions).map(v => Math.pow(10, v)); 
            }
            _histogramGen = d3.histogram().domain(domain).thresholds(thresholds);
        }
        return _histogramGen;
    }
    function filterData(curveData, zone) {
        return curveData.filter(d => ((zone.startDepth - d.depth)*(zone.endDepth - d.depth) <= 0));
    }
    function getCorrectValue(val1, val2) {
        return _.isFinite(val1) ? val1 : val2;

    }
    this.getLeft = () => {
        if(self.config.flipHorizontal) {
            return getCorrectValue(getCorrectValue(self.config.right, self.defaultConfig.right), 1) ;
        }
        return getCorrectValue(getCorrectValue(self.config.left, self.defaultConfig.left), 0) ;
    }
    this.getRight = () => {
        if(self.config.flipHorizontal) {
            return getCorrectValue(getCorrectValue(self.config.left, self.defaultConfig.left), 1) ;
        }
        return getCorrectValue(getCorrectValue(self.config.right, self.defaultConfig.right), 0) ;
    } 
    this.getLoga = () => (self.config.loga === undefined? self.defaultConfig.loga : self.config.loga)
    this.getNotUsedGaussian = () => {self.config.notUsedGaussian || false};
    this.getDivisions = () => (self.config.divisions || self.defaultConfig.divisions || 35)
    this.getColorMode = () => (self.config.colorMode || self.defaultConfig.colorMode || 'zone')
    this.getColor = (zone, well) => {
        let cMode = self.getColorMode();
        return cMode === 'zone' ? zone.zone_template.background:(cMode === 'well'?well.color:'blue');
    }
    this.getDisplayMode = () => (self.config.displayMode || self.defaultConfig.displayMode || 'bar')
    this.getStackMode = () => {
        if (self.noStack) return 'none';
        return self.getDisplayMode() === 'bar'?(self.config.stackMode||self.defaultConfig.stackMode||'none'):'none'
    }
    this.getBinGap = () => (self.config.binGap || self.defaultConfig.binGap)
    this.getBinX = (bin) => ((bin.x0 + bin.x1)/2)
    this.getBinY = (bin) => (bin.length)

    this.colorFn = function(bin, bins) {
        if (self.getStackMode() === 'none');
        return bins.color;
    }

    this.save = function() {
        console.log('save');
        if (!self.idHistogram) {
            wiDialog.promptDialog({
                title: 'New Histogram',
                inputName: 'Histogram Name',
                input: self.getConfigTitle(),
            }, function(name) {
                let type = 'HISTOGRAM';
                self.setConfigTitle(null, name);
                let content = {
                    wellSpec: self.wellSpec,
                    zonesetName: self.zonesetName,
                    selectionType: self.selectionType,
                    selectionValue: self.selectionValue,
                    config: self.config	
                }
                wiApi.newAssetPromise(self.idProject, name, type, content).then(res => {
                    self.idHistogram = res.idParameterSet;
                    self.onSave && self.onSave(res);
                }).catch(e => {
                    let msg = `Asset ${name} has been existed`;
                    if (__toastr) __toastr.warning(msg);
                    self.save();
                })
            });
        }
        else {
            let type = 'HISTOGRAM';
            let content = {
                idParameterSet: self.idHistogram,
                wellSpec: self.wellSpec,
                zonesetName: self.zonesetName,
                selectionType: self.selectionType,
                selectionValue: self.selectionValue,
                config: self.config	
            }
            wiApi.editAssetPromise(self.idHistogram, content).then(res => {
                console.log(res);
            }).catch(e => {
                    let msg = `Asset ${name} has been existed`;
                    if (__toastr) __toastr.warning(msg);
                    self.save();
                });
        }
    }
    this.saveAs = function() {
        console.log("saveAs");
        wiDialog.promptDialog({
            title: 'Save As Histogram',
            inputName: 'Histogram Name',
            input: '',
        }, function(name) {
            let type = 'HISTOGRAM';
            let content = {
                wellSpec: self.wellSpec,
                zonesetName: self.zonesetName,
                selectionType: self.selectionType,
                selectionValue: self.selectionValue,
                config: self.config
            }
            wiApi.newAssetPromise(self.idProject, name, type, content).then(res => {
                self.onSaveAs && self.onSaveAs(res);
            })
                .catch(e => {
                    let msg = `Asset ${name} has been existed`;
                    if (__toastr) __toastr.warning(msg);
                    self.saveAs();
                })
        });
    }

    let _zoneNames = []
    self.getZoneNames = function() {
        _zoneNames.length = 0;
        Object.assign(_zoneNames, self.histogramList.map(bins => bins.name));
        return _zoneNames;
    }
    self.getStatsRowIcons = function(rowIdx) {
        return ['rectangle'];
    }
    self.getStatsIconStyle = function(rowIdx) {
        return {
            'background-color': self.histogramList[rowIdx].color
        }
    }
    self.statsValue = function ([row, col]) {
        let statsArray = [];
        switch(self.getStackMode()) {
            case 'none':
                statsArray = flattenHistogramList.map(e => e.stats);
                break;
            case 'well':
                statsArray = [...listWellStats];
                break;
            case 'zone':
                statsArray = flattenHistogramList.map(e => e.stats);
                break;
            case 'all':
                // statsArray = [...listAllStats];
                statsArray = flattenHistogramList.map(e => e.stats);
                break;
            default:
                statsArray = [];
        }

        try {
            switch(_headers[col]){
                case 'X-Axis':
                    return statsArray[row].curveInfo || 'N/A';
                case 'Filter':
                    return statsArray[row].conditionExpr || 'N/A';
                case 'Top': 
                    return isNaN(statsArray[row].top) ? 'N/A' : wiApi.bestNumberFormat(statsArray[row].top, 4);
                case 'Bottom': 
                    return isNaN(statsArray[row].bottom) ? 'N/A' : wiApi.bestNumberFormat(statsArray[row].bottom, 4);
                case 'Points':
                    return isNaN(statsArray[row].numPoints) ? 'N/A' : statsArray[row].numPoints;
                case 'Avg':
                    return isNaN(statsArray[row].avg) ? 'N/A' : wiApi.bestNumberFormat(statsArray[row].avg, 4);
                case 'Min':
                    return isNaN(statsArray[row].min) ? 'N/A' : wiApi.bestNumberFormat(statsArray[row].min, 4);
                case 'Max':
                    return isNaN(statsArray[row].max) ? 'N/A' : wiApi.bestNumberFormat(statsArray[row].max, 4);
                case 'Avgdev': 
                    return isNaN(statsArray[row].avgdev) ? 'N/A' : wiApi.bestNumberFormat(statsArray[row].avgdev, 4);
                case 'Stddev': 
                    return isNaN(statsArray[row].stddev) ? 'N/A' : wiApi.bestNumberFormat(statsArray[row].stddev, 4);
                case 'Var':
                    return isNaN(statsArray[row].var) ? 'N/A' : wiApi.bestNumberFormat(statsArray[row].var, 4);
                case 'Skew':
                    return isNaN(statsArray[row].skew) ? 'N/A' : wiApi.bestNumberFormat(statsArray[row].skew, 4);
                case 'Kurtosis':
                    return isNaN(statsArray[row].kurtosis) ? 'N/A' : wiApi.bestNumberFormat(statsArray[row].kurtosis, 4);
                case 'Median':
                    return isNaN(statsArray[row].median) ? 'N/A' : wiApi.bestNumberFormat(statsArray[row].median, 4);
                case 'P10': 
                    return isNaN(statsArray[row].p10) ? 'N/A' : wiApi.bestNumberFormat(statsArray[row].p10, 4);
                case 'P50': 
                    return isNaN(statsArray[row].p50) ? 'N/A' : wiApi.bestNumberFormat(statsArray[row].p50, 4);
                case 'P90': 
                    return isNaN(statsArray[row].p90) ? 'N/A' : wiApi.bestNumberFormat(statsArray[row].p90, 4);
                default: 
                    return "this default";
            }
        } catch {
            return 'N/A';
        }
    }
    let _headers = [];
    self.getHeaders = function (){
        _headers.length = 0;
        Object.assign(_headers, self.statisticHeaders.filter((item, idx) => self.statisticHeaderMasks[idx]));
        return _headers;
    }
    this.hideSelectedGaussian = function() {
        if (!self.selectedGaussian) return;
        self.selectedGaussian.forEach(gaussian => gaussian._useGssn = false);
        if (self.config.notUsedGaussian) {
            self.setLogNormalDFn(self.histogramList);
        } else {
            self.setGaussianData(self.histogramList);
        }
        self.setCumulativeData(self.histogramList);
    }
    this.showSelectedGaussian = function() {
        if (!self.selectedGaussian) return;
        self.selectedGaussian.forEach(gaussian => gaussian._useGssn = true);
        if (self.config.notUsedGaussian) {
            self.setLogNormalDFn(self.histogramList);
        } else {
            self.setGaussianData(self.histogramList);
        }
        self.setCumulativeData(self.histogramList);
    }
    this.hideAllGaussian = function() {
        self.histogramList.forEach(gaussian => gaussian._useGssn = false);
        if (self.config.notUsedGaussian) {
            self.setLogNormalDFn(self.histogramList);
        } else {
            self.setGaussianData(self.histogramList);
        }
        self.setCumulativeData(self.histogramList);
    }
    this.showAllGaussian = function() {
        self.histogramList.forEach(gaussian => gaussian._useGssn = true);
        if (self.config.notUsedGaussian) {
            self.setLogNormalDFn(self.histogramList);
        } else {
            self.setGaussianData(self.histogramList);
        }
        self.setCumulativeData(self.histogramList);
    }
    this.hideSelectedLayer = function() {
        if(!self.selectedLayers) return;
        self.selectedLayers.forEach(layer => layer._notUsed = true);
    }
    this.showSelectedLayer = function() {
        if(!self.selectedLayers) return;
        self.selectedLayers.forEach(layer => layer._notUsed = false);
        $timeout(() => {});
    }
    this.hideAllLayer = function() {
        self.histogramList.forEach(bins => bins._notUsed = true);
        $timeout(() => {});
    }
    this.showAllLayer = function() {
        self.histogramList.forEach(bins => bins._notUsed = false);
        $timeout(() => {});
    }
    this.hideAllCtrlParams = function() {
        $timeout(() => {
            self.ctrlParamsMask = self.ctrlParamsMask.map(m => false);
        });
    }
    this.showAllCtrlParams = function() {
        //self.ctrlParamsMask.forEach(m => m = true);
        $timeout(() => {
            self.ctrlParamsMask = self.ctrlParamsMask.map(m => true);
        });
    }
    this.hideSelectedCtrlParams = function() {
        if(!self.selectedCtrlParams) return;
        self.selectedCtrlParams.forEach(cp => {
            cp = cp.data;
            let ctrlParamIdx = self.ctrlParams.findIndex(cpI => cp.$res.name === cpI.$res.name && cp.zoneInfo.idZone == cpI.zoneInfo.idZone);
            if (ctrlParamIdx >= 0) {
                self.ctrlParamsMask[ctrlParamIdx] = false;
            }
        });
    }
    this.showSelectedCtrlParams = function() {
        if(!self.selectedCtrlParams) return;
        self.selectedCtrlParams.forEach(cp => {
            cp = cp.data;
            let ctrlParamIdx = self.ctrlParams.findIndex(cpI => cp.$res.name === cpI.$res.name && cp.zoneInfo.idZone == cpI.zoneInfo.idZone);
            if (ctrlParamIdx >= 0) {
                self.ctrlParamsMask[ctrlParamIdx] = true;
            }
        });
        $timeout(() => {});
    }

    //--------------

    this.hideSelectedZone = function() {
        if(!self.selectedZones) return;
        self.selectedZones.forEach(zone => {
            zone._notUsed = true;
            let zoneTree = self.zoneTree.filter(zoneI => zoneI.zone_template.name == zone.name);
            zoneTree.forEach(zoneI => {
                zoneI._notUsed = true;
            })
        });
    }
    this.showSelectedZone = function() {
        if(!self.selectedZones) return;
        self.selectedZones.forEach(zone => {
            zone._notUsed = false;
            let zoneTree = self.zoneTree.filter(zoneI => zoneI.zone_template.name == zone.name);
            zoneTree.forEach(zoneI => {
                zoneI._notUsed = false;
            })
        });
        $timeout(() => {});
    }
    this.hideAllZone = function() {
        self.zoneTreeUniq.forEach(zone => {
            zone._notUsed = true;
        });
        self.zoneTree.forEach(zone => zone._notUsed = true);
        $timeout(() => {});
    }
    this.showAllZone = function() {
        self.zoneTreeUniq.forEach(zone => {
            zone._notUsed = false;
        });
        self.zoneTree.forEach(zone => zone._notUsed = false);
        $timeout(() => {});
    }
    this.onDrop = function (event, helper, myData) {
        let idWells = helper.data('idWells');
        if (idWells && idWells.length) {
            $timeout(() => {
                async.eachSeries(idWells, (idWell, next) => {
                    wiApi.getCachedWellPromise(idWell)
                        .then(well => {
                            let zonesets = well.zone_sets;
                            let hasZonesetName = self.zonesetName != 'ZonationAll' ? zonesets.some(zs => zs.name == self.zonesetName) : true;
                            if (hasZonesetName) {
                                let _idx = _.max(self.wellSpec.filter(ws => ws.idWell === idWell).map(ws => ws._idx));
                                _idx = (_idx >= 0 ? _idx : -1) + 1;
                                self.wellSpec.push({idWell, _idx});
                                let wellTree = getTree({idWell, _idx});
                                let curve = getCurve({...well, _idx});
                                if (!curve) {
                                    let msg = `Well ${well.name} does not meet requirement`;
                                    if (__toastr) __toastr.warning(msg);
                                    console.warn(msg);
                                }
                            } else if (!hasZonesetName) {
                                let msg = `User dataset do not have ${self.zonesetName}`;
                                if (__toastr) __toastr.warning(msg);
                                console.warn(msg);
                            }
                            next(null);
                        })
                        .catch(e => {
                            console.error(e);
                            next(e);
                        })
                }, err => {
                    if (err) {
                        console.error(err);
                    }
                })
            })
        }
    }
    this.toggleWell = function(well) {
        well._notUsed = !well._notUsed;
    }
    this.removeWell = function(well) {
        let index = self.wellSpec.findIndex(wsp => wsp.idWell === well.idWell && wsp._idx === well._idx);
        if(index >= 0) {
            $timeout(() => {
                self.wellSpec.splice(index, 1);
                let wellTreeIdx = self.treeConfig.findIndex(wTI => wTI.idWell === well.idWell && wTI._idx === well._idx);
                self.treeConfig.splice(wellTreeIdx, 1);
            })
        }
        //getTrees();
    }

    this.cmltLineData = [];
    function getLayerUseGssn() {
        let layers = self.histogramList.filter(layer => layer._useGssn);
        return layers.length;
    }
    this.condition4CumulativeLine = function() {
        return getLayerUseGssn() && self.cmltLineData.length && !self.config.notShowCumulative;
    }
    this.setCumulativeData = function(layers) {
        self.cmltLineData.length = 0;
        if (!layers.length) return;
        if (self.getStackMode() != 'all') {
            layers = layers.filter(l => l._useGssn);
        } else if (!layers._useGssn) {
            return;
        }
        if (self.getStackMode() === 'well' ||
            self.getStackMode() === 'zone') layers = layers.flat();
        let newData = [];
        for (let i = 0; i < self.getDivisions(); i++) {
            let elem = [];
            for (let j = 0; j < layers.length; j++) {
                elem = [...elem, ...layers[j][i]];
                elem.x0 = layers[j][i].x0;
                elem.x1 = layers[j][i].x1;
            }
            newData.push(elem);
        }
        newData.totalPoint = _.sum(newData.map(d => d.length));
        let cumulativeVal = 0;
        newData.forEach(l => {
            cumulativeVal += l.length;
            self.cmltLineData.push({
                x: (l.x0 + l.x1) / 2,
                y: (cumulativeVal / newData.totalPoint) * self.maxY
            });
            self.cmltLineData.color = self.cmltLineData.color || colorGenerator();
            self.cmltLineData.width = self.cmltLineData.width || 2;
        })
    }
    this.condition4GaussianLine = function() {
        return getLayerUseGssn() && Object.keys(self.gaussianLine || {}).length && !self.config.notUsedGaussian;
    }
    this.setGaussianData = function(layers) {
        self.gaussianLine = self.gaussianLine || {};
        if (!layers.length) {
            self.gaussianLine._notUsed = true;
            return;
        }
        if (self.getStackMode() != 'all') {
            layers = layers.filter(l => l._useGssn);
        } else if (!layers._useGssn) {
            return;
        }
        self.gaussianLine._notUsed = false;
        if (self.getStackMode() === 'well' ||
            self.getStackMode() === 'zone') layers = layers.flat();
        let fullData = [];
        for (let lIdx = 0; lIdx < layers.length; lIdx++) {
            for (let bIdx = 0; bIdx < layers[lIdx].length; bIdx++) {
                fullData = fullData.concat(layers[lIdx][bIdx]);
            }
        }
        let mean = d3.mean(fullData);
        let sigma = d3.deviation(fullData);
        self.gaussianLine = {
            ...self.gaussianLine,
            mean, sigma,
            width: 2,
        }
        self.gaussianLine.fn = (function(x) {
            let mean = this.mean;
            let sigma = this.sigma;
            let gaussianConstant = 1 / Math.sqrt(2 * Math.PI);
            x = (x - mean) / sigma;
            return gaussianConstant * Math.exp(-.5 * x * x) / sigma;
        }).bind(self.gaussianLine);
        self.gaussianLine.color = self.gaussianLine.color || colorGenerator();
        self.gaussianLine.sigmaLines = [
            {color: self.gaussianLine.color, value: mean - sigma},
            {color: self.gaussianLine.color, value: mean + sigma}
        ]
    }
    this.condition4LogNormalD = function() {
        return getLayerUseGssn() && Object.keys(self.logNormalDLine || {}).length && self.config.notUsedGaussian;
    }
    this.setLogNormalDFn = function(layers) {
        self.logNormalDLine = self.logNormalDLine || {};
        if (!layers.length) {
            self.logNormalDLine._notUsed = true;
            return;
        }
        if (self.getStackMode() != 'all') {
            layers = layers.filter(l => l._useGssn);
        } else if (!layers._useGssn) {
            return;
        }
        self.logNormalDLine._notUsed = false;
        if (self.getStackMode() === 'well' ||
            self.getStackMode() === 'zone') layers = layers.flat();
        let fullData = [];
        for (let lIdx = 0; lIdx < layers.length; lIdx++) {
            for (let bIdx = 0; bIdx < layers[lIdx].length; bIdx++) {
                fullData = fullData.concat(layers[lIdx][bIdx]);
            }
        }
        let mean = d3.mean(fullData);
        let sigma = d3.deviation(fullData);
        self.logNormalDLine = {
            ...self.logNormalDLine,
            mean, sigma,
            width: 2
        }
        self.logNormalDLine.fn = (function(x) {
            if (x <= 0) return 0;
            let mean = this.mean,
                sigma = this.sigma,
                s2 = Math.pow(sigma, 2),
                A = 1 / (Math.sqrt(2 * Math.PI)),
                B = -1 / (2 * s2);
            return (1 / (x * sigma)) * A * Math.exp(B * Math.pow(Math.log(x) - mean, 2));
        }).bind(self.logNormalDLine);
        self.logNormalDLine.color = self.logNormalDLine.color || colorGenerator();
    }
    this.getCumulativeX = cmlt => {
        return cmlt.x;
    };
    this.getCumulativeY = cmlt => {
        return cmlt.y;
    }

    function colorGenerator() {
        let rand = function () {
            return Math.floor(Math.random() * 255);
        }
        return "rgb(" + rand() + "," + rand() + "," + rand() + ")";
    }

    this.getMarkerGaussianVal = (marker, idx) => (marker.value)
    this.setMarkerGaussianVal = (marker, idx, newVal) => {marker.value = newVal;}
    this.markerGaussianStyle = (marker, idx) => ({stroke:marker.color,'stroke-width':'2', fill:'none'})
/*
    this.getMarkerVal = (marker, idx) => (marker.value)
    this.setMarkerVal = (marker, idx, newVal) => {marker.value = newVal;}
    this.markerStyle = (marker, idx) => ({stroke:marker.color,'stroke-width':'2', fill:'none'})
    this.markerName = (marker, idx) => (marker.name)
    */
    this.resetHistogramList = resetHistograms;
    function resetHistograms() {
        self.histogramList = [];
    }
}
