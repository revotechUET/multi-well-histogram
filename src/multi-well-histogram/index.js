var componentName = 'multiWellHistogram';
module.exports.name = componentName;
require('./style.less');

var app = angular.module(componentName, [
    'sideBar', 'wiTreeView',
    'wiApi', 'editable', 'wiDialog', 'wiDroppable'
]);
app.component(componentName, {
    template: require('./template.html'),
    controller: multiWellHistogramController,
    controllerAs: 'self',
    bindings: {
        token: "<",
        idProject: "<",
        wells: "<"
    },
    transclude: true
});

function multiWellHistogramController($scope, $timeout, $element, wiToken, wiApi, wiDialog) {
    let self = this;
    self.treeConfig = [];
    self.selectedNode = null;
    self.datasets = {};
    this.getDataset = function(well) {
        wiApi.getWellPromise(well.idWell).then((well) => {
            self.datasets[well] = well.datasets;
        }).catch(e => console.error(e));
    }
    
    this.getCurves = function(well) {
        
    }
    this.$onInit = function () {
        self.wells = self.wells || [];
        self.selectionType = self.selectionType || 'family-group';
        if (self.token)
            wiToken.setToken(self.token);
        getTree();
    }




    this.runMatch = function (node, criteria) {
        return node.name.includes(criteria);
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
        return null;
    }
    this.clickFunction = function ($event, node, selectedObjs) {
        updateNode(node);
        self.selectedNode = node;
    }
    self.refresh = getTree;
    function getTree() {
        self.treeConfig = [];
        for (let w of self.wells) {
            wiApi.getWellPromise(w).then(well => {
                self.treeConfig.push(well);
                $timeout(() => {});
            }).catch(e => console.error(e));
        }
        /*wiApi.getWellsPromise(self.idProject)
            .then(wells => $timeout(
                () => self.treeConfig = wells.sort(
                    (w1, w2) => (w1.name.localeCompare(w2.name))
                )
            ))
            .catch(err => console.error(err));
        */    
    }


    self.onDrop = function (event, ui, nodeArray) {
        for (let node of nodeArray) {
            if (isWell(node)) {
                let index = self.wells.findIndex((w) => (w.idWell === node.idWell));
                if (index < 0) {
                    self.wells.push(node);
                    $timeout( () => {});
                }
            }
        }
    }

    function updateNode(node, force) {
    }
    function isWell(node) {
        return true;
    }

}
