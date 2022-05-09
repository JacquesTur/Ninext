var exViewEventVersion = '1.04 beta';

/* 
V1.01 beta :
bug fix : check that the initialization is done on a view field

V1.02
update : add onload call when visiblity function is fired to update view field;

V1.03
update : add onclick event with event parameter;

V1.04 : 09/05/2022
bugfix : let default click run when one group has been clicked
*/


window.exViewEvent = exFinder = (function () {
    var myInterval = setInterval(() => {
        var view = document.getElementsByClassName("component editor editor-list editor-4col")[0];
        if (view) {
            document.getElementsByClassName("component editor editor-list editor-4col").forEach(cpn => {
                var Do = $(cpn).data().component;

                if (Do && Do.field && Do.field.base == "view" && !Object.getPrototypeOf(Do).exOldClick) {
                    Object.getPrototypeOf(Do).exOldClick = Object.getPrototypeOf(Do).click;
                    Object.getPrototypeOf(Do).click = function (e) {
                        
                        var fireOld = true;
                        if (this.query) {

                            var numCol = null;
                            var col = document.elementsFromPoint(e.clientX, e.clientY).find(element => element.classList.contains("t-cell"))
                            if (col) {
                                numCol = Array.from(col.parentElement.children).indexOf(col);
                                if (numCol != null) {

                                  
                                    var o = $(col.parentElement);
                                    if (o.length) {
                                        var a = parseInt(o.attr("data-ridx")) + this.ridxTop,
                                            n = this.query.rows[a];
                                        if (n) {
                                            if (this.query.groups[n]) {
                                               // let défault click run;
                                            }
                                            else {
                                                if (this.field && this.field.fn) {
                                                    var fn = exUtilsNx.extractNxFonctionInScript("onclick", this.field.fn, this.field);
                                                    if (fn) {
                                                        var params = {
                                                            previousID: this.query.nidSelected,
                                                            targetID: n,
                                                            targetLineNum : a,
                                                            targetColumnNum : numCol, 
                                                            targetColumnValue : col.innerText,
                                                        }
                                                        debugger;
                                                        fn += "; onclick(" + JSON.stringify(params) + ")"
                                                        exUtilsNx.fireEval(fn, this.query.nid);
                                                        fireOld = false;
                                                        this.query.nidSelected = n;
                                                        this.updateRows();
                                                    }
                                                }

                                            }

                                        }
                                    }
                                }
                            }
                        }

                        if (fireOld)
                            this.exOldClick(e);
                        console.log("view.onclick:" + e);

                    }

                    Object.getPrototypeOf(Do).exOldSelect = Object.getPrototypeOf(Do).select;
                    Object.getPrototypeOf(Do).select = function (nodeId, t) {
                        var fireOld = true;
                        if (this.query && nodeId !== this.query.nidSelected) {
                            debugger;

                            if (this.field && this.field.fn) {
                                var fn = exUtilsNx.extractNxFonctionInScript("onselect", this.field.fn, this.field);
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

                    Object.getPrototypeOf(Do).viewKeyDown = function (e) {

                        switch (e.which) {
                            case 27:
                                this.select(-1, null),
                                    e.preventDefault();
                                break;
                            case 38:
                                this.prev(),
                                    e.preventDefault();
                                break;
                            case 40:
                                this.next(),
                                    e.preventDefault()
                        }
                    }

                    Object.getPrototypeOf(Do).exOldupdateVisibility = Object.getPrototypeOf(Do).updateVisibility;
                    Object.getPrototypeOf(Do).updateVisibility = function (e) {

                        if (this.field.visibility)
                            var fn = exUtilsNx.extractNxFonctionInScript("onload", this.field.visibility, this.field);
                        if (fn) {

                            fn += '; onload()';
                            var id = exUtilsNx.fireEval(fn, this.query.nid);
                            this.query.nidSelected = id;
                            this.updateRows();
                        }

                        this.exOldupdateVisibility(e);
                    }

                    clearInterval(myInterval);
                    //alert('hook en place');


                    var lst = cpn.getElementsByClassName("list")[0];
                    if (lst) {
                        $(lst).off("click");
                        $(lst).touch($.proxy(Do.click, Do));
                        //$(lst).addEventListener("keydown", $.proxy(Do.keydown, Do), !1)
                    }
                    // cpn.addEventListener( "keydown", viewKeyDown, false);
                    // this.keydown = $.proxy(this.keydown, this),
                    // this.$input.addEventListener("keydown", $.proxy(Object.getPrototypeOf(Do).keydown, tObject.getPrototypeOf(Do)), !1)


                }
            });
        }
    }, 1000);
    return {
        version: exViewEventVersion,
    }
})()