var componentName = 'multiWellHistogram';
module.exports.name = componentName;
require('./style.less');

var app = angular.module(componentName, [
    'sideBar', 'wiTreeView',
    'wiApi', 'editable', 'wiDialog', 'editable',
    'wiDroppable', 'wiDropdownList','plot-toolkit'
]);
app.component(componentName, {
    template: require('./template.html'),
    controller: multiWellHistogramController,
    controllerAs: 'self',
    bindings: {
        token: "<",
        idProject: "<",
        wellSpec: "<",
        curveNames: "<",
        zonesetName: "<",
        selectionType: "<",
        selectionValue: "<"
    },
    transclude: true
});

function multiWellHistogramController($scope, $timeout, $element, wiToken, wiApi, wiDialog) {
    let self = this;
    self.treeConfig = [];
    self.selectedNode = null;
    self.datasets = {};

    window.MWHist = self;
    //--------------
    $scope.tab = 1;
    self.selectionTab = self.selectionTab || 'Wells';

    $scope.setTab = function(newTab){
      $scope.tab = newTab;
    };

    $scope.isSet = function(tabNum){
      return $scope.tab === tabNum;
    };

    //--------------
    this.getDataset = function(well) {
        wiApi.getWellPromise(well.idWell).then((well) => {
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
    this.$onInit = function () {
        if (self.token)
            wiToken.setToken(self.token);
        $timeout(() => {
            $scope.$watch(() => (self.wellSpec.map(wsp => wsp.idWell)), () => {
                getTree(function() {
                    getSelectionList(self.selectionType, self.treeConfig);
                    getZonesetsFromWells(self.treeConfig);

                    $scope.$watch(() => (self.selectionType), () => {
                        getSelectionList(self.selectionType, self.treeConfig);
                        updateDefaultConfig();
                    });
                    $scope.$watch(() => (self.selectionValue), () => {
                        updateDefaultConfig();
                    });
                    /*
                    $scope.$watch(() => (
                        `${self.getLeft()}-${self.getRight()}-${self.getLoga()}-${self.getDivisions()}-${self.selectionValue}`
                    ), () => {
                        _histogramGen = null;
                    });
                    */

                });
            }, true);
        }, 500);

        self.defaultConfig = self.defaultConfig || {};
        self.wellSpec = self.wellSpec || [];
        self.selectionType = self.selectionType || 'family-group';
        self.zoneTree = [];
        self.zonesetName = self.zonesetName || "ZonationAll";
        self.curveNames = self.curveNames || [];
        self.config = self.config || {grid:true, displayMode: 'line'};
    }

    this.onInputSelectionChanged = function(selectedItemProps) {
        self.selectionValue = (selectedItemProps || {}).name;
    }

    function getSelectionList(selectionType, wellArray) {
        console.log(wellArray);
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
        let wellSpec = self.wellSpec.find(wsp => wsp.idWell === treeRoot.idWell);
        wellSpec.idCurve = node.idCurve;
        wellSpec.idDataset = node.idDataset;
    }
    self.refresh = getTree;
    function getTree(callback) {
        self.treeConfig = [];
        let promises = [];
        for (let w of self.wellSpec) {
            promises.push(
                wiApi.getWellPromise(w.idWell || w)
                    .then(well => (self.treeConfig.push(well)))
            );
        }
        Promise.all(promises).then(() => callback && callback()).catch(e => console.error(e));
    }
    function getZonesetsFromWells(wells) {
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
    this.getCurve = getCurve;
    function getCurve(well, wellSpec) {
        if (!well || !wellSpec) return null;

        let curves = getCurvesInWell(well).filter(c => self.runMatch(c, self.selectionValue));
        let curve = wellSpec.idCurve ? curves.find(c => c.idCurve === wellSpec.idCurve) : curves[0];
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
    this.onZonesetSelectionChanged = function(selectedItemProps) {
        self.zoneTree = (selectedItemProps || {}).zones;
    }
    this.runZoneMatch = function (node, criteria) {
        return true;
    }
    this.getZoneLabel = function (node) {
        return node.zone_template.name;
    }
    this.getZoneIcon = function (node) {
        return (node && !node._notUsed) ? 'zone-16x16': 'fa fa-times-circle'
    }
    const EMPTY_ARRAY = []
    this.noChildren = function (node) {
        return EMPTY_ARRAY;
    }
    this.click2Toggle = function ($event, node, selectedObjs) {
        node._notUsed = !node._notUsed;
    }
    
    this.runLayerMatch = function (node, criteria) {
        return node.name.includes(criteria);
    }
    this.getLayerLabel = function (node) {
        return node.name;
    }
    this.getLayerIcon = function (node) {
        return (node && !node._notUsed) ? 'zone-16x16': 'fa fa-times-circle'
    }
    this.getConfigLeft = function() {
        self.config = self.config || {};
        return isNaN(self.config.left) ? "[empty]": wiApi.bestNumberFormat(self.config.left, 3);
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
        return (self.config.title || "").length ? self.config.title : "[empty]";
    }
    this.setConfigTitle = function(notUse, newValue) {
        self.config.title = newValue;
    }
    this.getConfigXLabel = function() {
        self.config = self.config || {};
        return (self.config.xLabel || "").length ? self.config.xLabel : "[empty]";
    }
    this.setConfigXLabel = function(notUse, newValue) {
        self.config.xLabel = parseInt(newValue);
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
        self.defaultConfig.left = family.family_spec[0].minScale;
        self.defaultConfig.right = family.family_spec[0].maxScale;
        self.defaultConfig.loga = family.family_spec[0].displayType.toLowerCase() === 'logarithmic';
    }

    this.histogramList = [];
    this.genHistogramList = async function() {
        this.histogramList.length = 0;
        _histogramGen = null;
        try {
            let max = 0;
            for (let i = 0; i < self.treeConfig.length; i++) {
                let well = self.treeConfig[i];
                let curve = getCurve(well, self.wellSpec[i]);
                if (!curve) {
                    self.histogramList.push([]);
                    continue;
                }
                let datasetTop = self.wellSpec[i].datasetTop;
                let datasetBottom = self.wellSpec[i].datasetBottom;
                let datasetStep = self.wellSpec[i].datasetStep;

                let zoneset = getZoneset(well, self.zonesetName);
                zoneset = zoneset || genZonationAllZS(datasetTop, datasetBottom, well.color);

                let curveData = await wiApi.getCurveDataPromise(curve.idCurve);
                curveData = curveData.filter(d => _.isFinite(d.x))
                    .map(d => ({
                        ...d, 
                        depth: datasetStep>0?(datasetTop + d.y * datasetStep):d.y
                    }));
                let zones = zoneset.zones.filter(zone => {
                    let z = self.zoneTree.find(z1 => {
                        return z1.zone_template.name === zone.zone_template.name
                    });
                    return !z._notUse;
                });
                for (let j = 0; j < zones.length; j++) {
                    let zone = zones[j];
                    let dataArray = filterData(curveData, zone);
                    let bins = genBins(dataArray);
                    let maybeMax = d3.max(bins.map(b => b.length));
                    max = (max > maybeMax) ? max : maybeMax;
                    bins.color = self.getColorMode() === 'zone' ? zone.zone_template.background:well.color;
                    bins.name = `${well.name}.${zone.zone_template.name}`;
                    self.histogramList.push(bins);
                }
            }
            $timeout(() => {
                self.minY = 0;
                self.maxY = max;
            });
        }
        catch(e) {
            console.error(e);
        }
        console.log('end');
    }
    function genZonationAllZS(top, bottom, color = 'blue') {
        return {
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

    this.getLeft = () => ( self.config.left || self.defaultConfig.left || 0 )
    this.getRight = () => ( self.config.right || self.defaultConfig.right || 0 )
    this.getLoga = () => (self.config.loga || self.defaultConfig.loga || 0)
    this.getDivisions = () => (self.config.divisions || self.defaultConfig.divisions || 10)
    this.getColorMode = () => (self.config.colorMode || self.defaultConfig.colorMode || 'zone')
    this.getDisplayMode = () => (self.config.displayMode || self.defaultConfig.displayMode || 'bar')
    this.getBinX = (bin) => ((bin.x0 + bin.x1)/2)
    this.getBinY = (bin) => (bin.length)

    this.colorFn = function(bin, bins) {
        return bins.color;
    }

    self.onDrop = function (event, ui, nodeArray) {
    }
    function isWell(node) {
        return true;
    }
  
}
