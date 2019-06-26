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
        wellSpecs: "<",
        zonesetNames: "<",
        selectionTypes: "<",
        selectionValues: "<",
		idHistograms: "<",
		configs: '<',
        onSave: '<',
        onSaveAs: '<',
		titles: '<'
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
    }
    self.activateTab = function ($index){
        $timeout(()=>{
            $scope.tabIndex = $index;
        })

    }
}
