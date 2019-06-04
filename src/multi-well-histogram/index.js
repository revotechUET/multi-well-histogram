var componentName = 'multiWellHistogram';
module.exports.name = componentName;
require('./style.less');

const _DECIMAL_LEN = 4;

var app = angular.module(componentName, [
    'sideBar', 'wiTreeView', 'wiTableView',
    'wiApi', 'editable', 'wiDialog',
    'wiDroppable', 'wiDropdownList','plot-toolkit','wiLoading'
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

function multiWellHistogramController($scope, $timeout, $element, wiToken, wiApi, wiDialog, wiLoading) {
    let self = this;
    self.treeConfig = [];
    self.selectedNode = null;
    self.datasets = {};
    self.statisticHeaders = ['top','bottom','#pts','avg','min', 'max', 'avgdev', 'stddev', 'var', 'skew', 'kurtosis', 'median', 'p10', 'p50', 'p90'];
    self.statisticHeaderMasks = [true,true,true,true,true,true,true,true,true,true,true,true,true,true,true];
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
        self.config = self.config || {grid:true, displayMode: 'bar', colorMode: 'zone', stackMode: 'well', binGap: 5};
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
        wellSpec.curveName = node.Name;
    }
    self.refresh = getTree;
    function getTree(callback) {
        wiLoading.show($element.find('.main')[0]);
        self.treeConfig = [];
        let promises = [];
        for (let w of self.wellSpec) {
            promises.push(
                wiApi.getWellPromise(w.idWell || w)
                    .then(well => (self.treeConfig.push(well)))
            );
        }
        Promise.all(promises).then(() => callback && callback()).catch(e => console.error(e)).finally(() => wiLoading.hide());
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
        self.zonesetName = (selectedItemProps || {}).name || 'ZonationAll';
    }
    this.runZoneMatch = function (node, criteria) {
        return true;
    }
    this.getZoneLabel = function (node) {
        return node.zone_template.name;
    }
   
    this.getZoneIcon = (node) => ( (node && !node._notUsed) ? 'zone-16x16': 'fa fa-eye-slash' )
    const EMPTY_ARRAY = []
    this.noChildren = function (node) {
        return EMPTY_ARRAY;
    }
    this.click2ToggleZone = function ($event, node, selectedObjs) {
        node._notUsed = !node._notUsed;
        self.selectedZones = Object.values(selectedObjs).map(o => o.data);
    }
    this.click2ToggleLayer = function ($event, node, selectedObjs) {
        node._notUsed = !node._notUsed;
        self.selectedLayers = Object.values(selectedObjs).map(o => o.data);
    }
    
    this.runLayerMatch = function (node, criteria) {
        return node.name.includes(criteria);
    }
    let _layerTree = [];
    this.getLayerTree = function() {
        if(self.getStackMode() === 'all') {
            _layerTree[0] = self.histogramList;
            return _layerTree;
        }
        return self.histogramList;
    }
    this.getLayerLabel = (node) => node.name
    this.getLayerIcon = (node) => ( (node && !node._notUsed) ? 'layer-16x16': 'fa fa-eye-slash' )
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
	var flattenHistogramList = [];
    this.genHistogramList = async function() {
        this.histogramList.length = 0;
        let allHistogramList = []
        _histogramGen = null;
        wiLoading.show($element.find('.main')[0]);
        try {
            
            for (let i = 0; i < self.treeConfig.length; i++) {
                let well = self.treeConfig[i];
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

                let zoneset = getZoneset(well, self.zonesetName);
                zoneset = zoneset || genZonationAllZS(datasetTop, datasetBottom, well.color);

                let curveData = await wiApi.getCachedCurveDataPromise(curve.idCurve);
                curveData = curveData.filter(d => _.isFinite(d.x))
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
                let wellHistogramList = [];
                for (let j = 0; j < zones.length; j++) {
                    let zone = zones[j];
                    let dataArray = filterData(curveData, zone);
                    let bins = genBins(dataArray);
                    bins.color = self.getColor(zone, well);
                    bins.name = `${well.name}.${zone.zone_template.name}`;
					bins.top = zone.startDepth;
					bins.bottom = zone.endDepth;
                    bins.numPoints = dataArray.length;
                    try {
                        bins.avg = d3.mean(dataArray, d => d.x);
                        bins.min = d3.min(dataArray, d => d.x);
                        bins.max = d3.max(dataArray, d => d.x);
                        bins.stddev = d3.deviation(dataArray, d => d.x);
                        bins.avgdev = calAverageDeviation(dataArray.map(d => d.x));
                        bins.var = d3.variance(dataArray, d => d.x);
                        bins.median = d3.median(dataArray, d => d.x);
                        bins.skew = dataArray.length >= 3 ? ss.sampleSkewness(dataArray.map(d => d.x)) : undefined;
                        bins.kurtosis = dataArray.length >= 4 ? ss.sampleKurtosis(dataArray.map(d => d.x)) : undefined;
                        bins.p10 = calPercentile(dataArray.map(d => d.x), 0.1);
                        bins.p50 = calPercentile(dataArray.map(d => d.x), 0.5);
                        bins.p90 = calPercentile(dataArray.map(d => d.x), 0.9);
                        wellHistogramList.push(bins);
                    }
                    catch(e) {
                        console.error(e);
                    }
                }
                if (self.getStackMode() === 'well') {
                    wellHistogramList.name = well.name;
                    allHistogramList.push(wellHistogramList);
                }
                else allHistogramList.push(...wellHistogramList);
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
                case 'all': 
                {
                    let aggregate = aggregateHistogramList(allHistogramList);
                    max = d3.max(aggregate);
					flatten = allHistogramList;
                }
                break;
                    
            }
            $timeout(() => {
                self.minY = 0;
                self.maxY = max;
                self.histogramList = allHistogramList;
				flattenHistogramList = flatten;
            });
        }
        catch(e) {
            console.error(e);
        }
        wiLoading.hide();
        console.log('end');
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

    this.getLeft = () => ( self.config.left || self.defaultConfig.left || 0 )
    this.getRight = () => ( self.config.right || self.defaultConfig.right || 0 )
    this.getLoga = () => (self.config.loga || self.defaultConfig.loga || 0)
    this.getDivisions = () => (self.config.divisions || self.defaultConfig.divisions || 10)
    this.getColorMode = () => (self.config.colorMode || self.defaultConfig.colorMode || 'zone')
    this.getColor = (zone, well) => {
        let cMode = self.getColorMode();
        return cMode === 'zone' ? zone.zone_template.background:(cMode === 'well'?well.color:'blue');
    }
    this.getDisplayMode = () => (self.config.displayMode || self.defaultConfig.displayMode || 'bar')
    this.getStackMode = () => (self.config.stackMode || self.defaultConfig.stackMode || 'none')
    this.getBinGap = () => (self.config.binGap || self.defaultConfig.binGap)
    this.getBinX = (bin) => ((bin.x0 + bin.x1)/2)
    this.getBinY = (bin) => (bin.length)

    this.colorFn = function(bin, bins) {
        if (self.getStackMode() === 'none');
        return bins.color;
    }

    let _zoneNames = []
    self.getZoneNames = function() {
        _zoneNames.length = 0;
		// console.log(self.histogramList);
        Object.assign(_zoneNames, self.histogramList.map(bins => bins.name));
        return _zoneNames;
    }
    self.statsValue = function ([row, col]) {
		try {
			switch(_headers[col]){
				case 'top': 
					return flattenHistogramList[row].top || 'N/A';
				case 'bottom': 
					return flattenHistogramList[row].bottom || 'N/A';
					return bottom;
				case '#pts':
					return flattenHistogramList[row].numPoints || 'N/A';
				case 'avg':
					return flattenHistogramList[row].avg || 'N/A'
				case 'min':
					return flattenHistogramList[row].min || 'N/A'
				case 'max':
					return flattenHistogramList[row].max || 'N/A'
				case 'avgdev': 
					return flattenHistogramList[row].avgdev || 'N/A';
				case 'stddev': 
					return flattenHistogramList[row].stddev || 'N/A';
				case 'var':
					return flattenHistogramList[row].var || 'N/A';
				case 'skew':
					return flattenHistogramList[row].skew || 'N/A';
				case 'kurtosis':
					return flattenHistogramList[row].kurtosis || 'N/A';
				case 'median':
					return flattenHistogramList[row].median || 'N/A';
				case 'p10': 
					return flattenHistogramList[row].p10 || 'N/A';
				case 'p50': 
					return flattenHistogramList[row].p50 || 'N/A';
				case 'p90': 
					return flattenHistogramList[row].p90 || 'N/A';
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
    this.hideSelectedLayer = function() {
        self.selectedLayers.forEach(layer => layer._notUsed = true);
    }
    this.showSelectedLayer = function() {
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

    //--------------

    this.hideSelectedZone = function() {
        self.selectedZones.forEach(layer => layer._notUsed = true);
    }
    this.showSelectedZone = function() {
        self.selectedZones.forEach(layer => layer._notUsed = false);
        $timeout(() => {});
    }
    this.hideAllZone = function() {
        self.zoneTree.forEach(bins => bins._notUsed = true);
        $timeout(() => {});
    }
    this.showAllZone = function() {
        self.zoneTree.forEach(bins => bins._notUsed = false);
        $timeout(() => {});
    }
    this.onDrop = function (event, helper, myData) {
        let idWells = helper.data('idWells');
        if (idWells && idWells.length) {
            $timeout(() => {
                for (let idWell of idWells) {
                    if (!self.wellSpec.find(wsp => wsp.idWell === idWell)) {
                        self.wellSpec.push({idWell});
                    }
                }
            })
        }
    }
    this.toggleWell = function(well) {
        well._notUsed = !well._notUsed;
    }
    this.removeWell = function(well) {
        let index = self.wellSpec.findIndex(wsp => wsp.idWell === well.idWell);
        if(index >= 0) {
            self.wellSpec.splice(index, 1);
        }
    }
    
}
