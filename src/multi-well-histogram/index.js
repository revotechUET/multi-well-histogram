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
        $scope.$watch(() => (self.wells), () => {
            getTree(function() {
                getSelectionList(self.selectionType, self.treeConfig);
            });
        }, true);
        $scope.$watch(() => (self.selectionType), () => {
            getSelectionList(self.selectionType, self.treeConfig);
        })
        self.wells = self.wells || [];
        self.selectionType = self.selectionType || 'family-group';
        if (self.token)
            wiToken.setToken(self.token);
        // getTree();
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
                self.selectionList = Object.keys(selectionHash);
                break;
            case 'family': 
                allCurves.forEach(curve => {
                    let family = wiApi.getFamily(curve.idFamily);
                    if(family)
                        selectionHash[family.name] = 1;
                })
                self.selectionList = Object.keys(selectionHash);
                break;
            case 'family-group':
                allCurves.forEach(curve => {
                    let family = wiApi.getFamily(curve.idFamily);
                    if(family)
                        selectionHash[family.familyGroup] = 1;
                })
                self.selectionList = Object.keys(selectionHash);
                break;
        }

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
    function getTree(callback) {
        (async function() {
            self.treeConfig = [];
            try {
                for (let w of self.wells) {
                    let well = await wiApi.getWellPromise(w);
                    self.treeConfig.push(well);
                    // $timeout(() => {});
                }
            }
            catch(e) {
                console.error(e);
            }
            $timeout(() => {});
            callback && callback();
        })();
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
