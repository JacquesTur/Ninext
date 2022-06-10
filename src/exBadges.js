var exBadgesVersion = '1.03';

//V1.02 du 9 mai 2022
//bug fixe :
// minor bug : test if file icon is present before traitement.

//V1.03 du 9 juin 2022
//bug fixe :
// correct gestion of comments on Mac App : call it if database.loadComments function exist not if schemas.envConfig.userEnvName != 'mac'. 


//create global object to manage exBadges.
if (!window.exBadges) window.exBadges = { version: exBadgesVersion };

//style base of badges
exBadges.style = `
            position: absolute;
            display: flex;
            top: 0px;
            right: 0px;
            background-color: red;
            height: 15px;
            line-height: 15px;
            width: 15px;
            text-align: center;
            border-radius: 50%;
            color: white;
            justify-content: center;
            font-size: smaller`;
// color of selection
var filesColor = '#4970ff';
var oldCommentColor = '#999999';
var newCommentColor = 'red';
// Threshold of new or old comment in ms. For 1 day = 1000ms * 60s * 60mn * 24h = 86400000ms
var oldCommentThreshold = 1000 * 60 * 60 * 24;

//event function called when tab changeed or popup opened
function selectTab(e) {
    //call the original event fonction selectTab
    if (this.oldSelectTab) this.oldSelectTab(e);
    try {
        //recordver the current exBadges.editor with links to html components
        if (this.container) {
            console.log('badges : files load')
            //load files of current record (is async function)
            database.loadFiles(this.container.nid, (e, i) => {
                // e = error text
                // i = files array of id record this._id

                console.log('badges : files refresh')

                // recover the attached files icon on current exBadges.editor
                var files = this.files ? this.files.elTab[0] : null;
                if (files) {
                    //recover or create the badge
                    var badge = files.getElementsByTagName('span')[0];
                    if (!badge) {
                        badge = document.createElement('span');
                        files.appendChild(badge);
                    }

                    //reading file list en exclude files connected to fields
                    var n = database.typeOf(this.container.nid);
                    var r = database.loadNodeSync(this.container.nid);
                    if (n && r) {
                        var s = {},
                            l = n.fields;
                        for (var c in l) {
                            if (l.hasOwnProperty(c))
                                if ('file' === l[c].base) {
                                    var d = r[c];
                                    d && (s[d] = !0)
                                }
                        }
                        let f = []
                        for (var u = 0; u < i.length; u++)
                            s[(d = i[u]).name] || f.push(d);

                        //number attached files
                        var cnt = f.length;

                        //set the badge
                        badge.style.cssText = exBadges.style;
                        badge.innerText = cnt.toString();
                        badge.style.visibility = (cnt > 0) ? 'visible' : 'hidden';
                        badge.style.backgroundColor = filesColor;
                    }
                };
            });

            // load the comment only for the cloud database when loadComments function exist.
            if (database.loadComments) {
                console.log('badges : comments load')

                //load files of current record (is async function)
                database.loadComments(this.container.nid, (e, i) => {
                    // e = error text
                    // i = comments array of id record this._id

                    console.log('badges : comments refresh')

                    // recover the comment icon
                    var comments = this.comments ? this.comments.elTab[0] : null;
                    if (comments) {

                        //recover or create the badge
                        var badge = comments.getElementsByTagName('span')[0];
                        if (!badge) {
                            badge = document.createElement('span');
                            comments.appendChild(badge);

                        }

                        //get durrent time to compare with comment date
                        var ms = Date.now();

                        //count the number of new and old comments 
                        var cntNew = i.reduce((total, el) => {
                            if (ms - el[0] < oldCommentThreshold) total += 1;
                            return total;
                        }, 0);
                        var cntAll = i.length;

                        //set the badge with different color to indicate if there is new comments
                        badge.style.cssText = exBadges.style;
                        badge.innerText = cntNew ? cntNew.toString() : cntAll.toString();
                        badge.style.visibility = (cntAll + cntNew > 0) ? 'visible' : 'hidden';
                        badge.style.backgroundColor = (cntNew > 0) ? newCommentColor : oldCommentColor;

                    };
                })
            }
        }

    } catch (err) {
        console.log('badges error : ' + String(err.message));
    }

}

// On first call, put this selectTab in place to Ninox function and save the oldest
function setHook() {
    try {
        //exBadges.editor = ui.getCurrentEditor();
        if (!exBadges.editor) {
            if (exModules.myDiv) {
                var data = $(exModules.myDiv).closest('.component').data('component');
                if (data) {
                    exBadges.editor = data.container;
                }
            }

        }

        if (exBadges.editor && exBadges.editor.container && !Object.getPrototypeOf(exBadges.editor).oldSelectTab) {
            if (!Object.getPrototypeOf(exBadges.editor).oldSelectTab) {
                Object.getPrototypeOf(exBadges.editor).oldSelectTab = Object.getPrototypeOf(exBadges.editor).selectTab;
                Object.getPrototypeOf(exBadges.editor).selectTab = selectTab;
                console.log('badges initalized');

                exBadges.initalized = true;
                exBadges.editor.selectTab(exBadges.editor.currentTab.id);


                if (ui.getCurrentEditor() && ui.getCurrentEditor().currentTab)
                    ui.getCurrentEditor().selectTab(ui.getCurrentEditor().currentTab.id)
            }



        }
        else if (!exBadges.editor)
            setTimeout(setHook, 100);
    } catch (err) {
        alert('badges error : ' + String(err.message));
    }
}
setHook();
