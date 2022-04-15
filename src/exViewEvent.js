var exViewEventVersion = '1.00 beta';

window.exViewEvent = exFinder = (function () {
    var myInterval = setInterval(() => {
        var view = document.getElementsByClassName("component editor editor-list editor-4col")[0];
        if (view) {
            var cpn = document.getElementsByClassName("component editor editor-list editor-4col")[0];
            var Do = $(cpn).data().component;
            if (Do && !Object.getPrototypeOf(Do).exOldClick) {
                Object.getPrototypeOf(Do).exOldClick = Object.getPrototypeOf(Do).click;
                Object.getPrototypeOf(Do).click = function (e) {



                    // var fireOld = true;
                    // if (this.field && this.field.fn) {
                    //     var fn = exUtilsNx.extractNxFonctionInScript("onclick", fn);
                    //     if (this.query && fn) {
                    //         fn += " onclick("+this.queri.
                    //         exUtilsNx.fireEval(fn, this.query.nid);
                    //         fireOld = false;
                    //     }
                    // }
                    this.exOldClick(e);
                    console.log(e);

                }

                Object.getPrototypeOf(Do).exOldSelect = Object.getPrototypeOf(Do).select;
                Object.getPrototypeOf(Do).select = function (nodeId, t) {
                    var fireOld = true;
                    if (this.query && nodeId !== this.query.nidSelected) {
                        debugger;

                        if (this.field && this.field.fn) {
                            var fn = exUtilsNx.extractNxFonctionInScript("onclick", this.field.fn);
                            if (fn) {
                                this.query.nidSelected = nodeId;
                                this.updateRows();

                                fn += '; onselect("' + nodeId + '")';
                                exUtilsNx.fireEval(fn, this.query.nid);

                                fireOld = false;
                            }
                        }
                    }
                    if (fireOld) this.exOldSelect(nodeId, t);
                }

                clearInterval(myInterval);
                alert('hook en place');

                var cpns = document.getElementsByClassName("component editor editor-list editor-4col");
                debugger;
                cpns && cpns.forEach(element => {
                    $(element.getElementsByClassName("list")[0]).off("click");
                    $(element.getElementsByClassName("list")[0]).touch($.proxy(Do.click, Do))
                });
            }
        }
    }, 1000);
    return {
        version: exViewEventVersion,
    }
})()