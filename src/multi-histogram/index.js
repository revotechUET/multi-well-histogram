var componentName = 'multiHistogram';
module.exports.name = componentName;
require('./style.less');

const _DECIMAL_LEN = 4;

var app = angular.module(componentName, ['multiWellHistogram','wiLoading']);
app.component(componentName, {
    template: require('./template.html'),
    controller: multiHistogramController,
    controllerAs: 'self',
    bindings: {
        token: "<",
        idProject: "<",
        wellSpecs: "=",
        zonesetNames: "<",
        selectionTypes: "<",
        selectionValues: "<",
		idHistograms: "<",
        configs: '<',
        noStack: '<',
        ctrlParamsList: '<',
        onSave: '<',
        onSaveAs: '<',
		titles: '<',
        prefixs: '<',
        cpGetMarkerVal: '<',
        cpSetMarkerVal: '<',
        cpMarkerStyle: '<',
        cpMarkerName: '<',
        cpIcons: '<',
        cpIconStyle: '<'
    },
    transclude: true
});

function multiHistogramController($scope, $timeout, $element, wiToken, wiApi, wiDialog, wiLoading) {
    let self = this;
    self.silent = true;
    $scope.tabIndex = 0;

    this.$onInit = async function () {
        if (self.token)
            wiToken.setToken(self.token);
        console.log(self.zonesetNames);
    }
    self.activateTab = function ($index){
        $timeout(()=>{
            $scope.tabIndex = $index;
        })

    }
    this.onDrop = function (event, helper, myData) {
        let idCurves = helper.data("idCurves");
        let curveName;
        let idWell;
        if(idCurves){
            self.warning = false;
            wiLoading.show(document.getElementsByTagName("body")[0], false);
            wiApi.getCurveInfoPromise(idCurves[0]).then(curveInfo => {
                console.log(curveInfo);
                curveName = curveInfo.name;
                return wiApi.getDatasetInfoPromise(curveInfo.idDataset);
            }).then(datasetInfo => {
                idWell = datasetInfo.idWell;
                $timeout(()=>{
                    self.wellSpecs.push([{idWell}]);
                    self.selectionTypes.push('curve');
                    self.selectionValues.push(curveName);
                });
                wiLoading.hide();
            });
        } else {
            $timeout(()=>{
                self.warning = true;
            })
        }
        
    }
}
