var exFinderVersion = '1.00 beta';

var strStyles = `
.ex-finder-line {
    display: flex;
    width: 100%;
    border-bottom: 1px solid lightgray;
}`;

var style = document.getElementById('exCoredMirrorStyle');
if (!style)
    style = document.createElement('style');
document.head.appendChild(style);
style.innerText = strStyles;


exFinder = (function () {
    const expsName = ["onClick", "beforeUpdate", "afterUpdate", "visibility", "canWrite", "beforeShow", "afterHide"];

    function getExpressions(obj) {

        var lst = [];
        try {
            if (obj.fn) {
                if (!obj.exp) obj.exp = queries.parseSystem(database.schema, obj.type, obj.fn, null);
                lst.push({ obj: obj, name: "fn", exp: obj.exp, caption: obj.exp.toHumanString('', 0) });
            }

            expsName.forEach(n => {
                if (obj[n] && obj[n].length && !obj[n + "Exp"]) {

                    obj[n + "Exp"] = queries.parseSystem(database.schema, obj.type, obj[n], null);
                    if (exp)
                        obj.onClickExp = exp;
                }
            })

            for (var key in Object.keys(obj)) {
                var name = Object.keys(obj)[key].match(RegExp('.*(?=Exp\\b)'));
                if (name && name[0].length) {

                    var exp = obj[name[0] + "Exp"];
                    var caption = obj[name[0]];
                    lst.push({ obj: obj, name: name[0], exp: exp, caption: exp.toHumanString('', 0) });
                }

            }

            if (obj.viewConfig) {
                var type = database.schema.types[obj.viewConfig.type];
                if (obj.viewConfig.cols)
                    obj.viewConfig.cols.forEach(c => {


                        var exp = queries.parseSystem(database.schema, type, c.expression, null);
                        var name = c.caption ? c.caption : exp.toHumanString('', 0);
                        lst.push({ obj: obj, name: name, exp: exp, caption: exp.toHumanString('', 0) });

                        if (c.conditionalStyling) {

                            c.conditionalStyling.forEach(cs => {
                                if (cs.operand == 'f(x)') {

                                    var csExp = queries.parseSystem(database.schema, type, cs.value, null)

                                    lst.push({ obj: obj, name: name + ".conditionalStyling", exp: csExp, caption: csExp.toHumanString('', 0) });
                                }
                            })
                        }
                    })
            }
        }
        catch (err) {
            console.log("getExpressions error : " + err.message)
        }
        return lst;
    }
    function getFindElements() {
        var lstFunctions = [];
        for (var t in database.schema.types) {
            var type = database.schema.types[t];

            var lstExpType = getExpressions(type);
            lstExpType && lstExpType.forEach(e => {

                var fn = { obj: e.obj, table: type.caption, tableId: type.id, field: '', fieldId: '', caption: e.exp.toHumanString('', 0), name: e.name, exp: e.exp };
                lstFunctions.push(fn);
            });


            type.sorted.forEach(field => {
                var lstExpType = getExpressions(field);
                lstExpType && lstExpType.forEach(e => {
                    var fn = { obj: e.obj, table: type.caption, tableId: type.id, field: field.caption, fieldId: field.id, caption: e.exp.toHumanString('', 0), name: e.name, exp: e.exp };
                    lstFunctions.push(fn);
                });
            });
        }
        return lstFunctions;

    }
    function findFieldInExp(exp, tableId, fieldId) {
        var find = false;
        if (exp.field) {
            debugger;
            find = exp.field.type && exp.field.id == fieldId && exp.field.type.id == tableId;
        }
        if (exp.exprA) find |= findFieldInExp(exp.exprA, tableId, fieldId)
        if (exp.exprB) find |= findFieldInExp(exp.exprB, tableId, fieldId)
        if (exp.exprs) exp.exprs.forEach(e => {
            find |= findFieldInExp(e, tableId, fieldId)
        })
        if (exp.exps) exp.exps.forEach(e => {
            find |= findFieldInExp(e, tableId, fieldId)
        })
    }

    function findInList(elements, f, ft) {
        var lst = [];
        //        var re = new RegExp('\\b' + f + '\\b', 'i'); 
        elements && elements.forEach(element => {
            //            if (element.caption.search(re) != -1) {
            var find = false;
            switch (ft) {
                case 'text': find = (element.caption.toUpperCase().indexOf(f.toUpperCase()) >= 0); break;
                case 'field': {
                    debugger;
                    var t = database.schema.findElements(f.tableName);
                    var f = t.findElements(f.fieldName)
                    find = findFieldInExp(element.exp, t, f );
                }
            }
            if (find) {
                var e = Object.assign(element);
                delete e.exp;
                lst.push(element);
            }
        })
        return lst || [];
    }



    return {
        version: exFinderVersion,
        find: function (value, typeOfValue) {
            var lst = getFindElements();
            return findInList(lst, value, typeOfValue);
        },
        hmltFormat: function (lst, keyword) {
            var t = '';
            var f = '';
            function bolding(text, key) {
                var bt = '';
                var p = -1;
                while (p = text.toUpperCase().indexOf(key.toUpperCase()), p >= 0) {
                    bt += `${text.substr(0, p)}<span style='color:blue'><b>${text.substr(p, key.length)}</b></span>`;
                    text = text.substr(p + key.length);
                }
                return bt + text;
            }
            var typeClassName = '';
            var fieldClassName = '';
         
            lst.forEach((e) => {
                if (e.obj) {
                    if (e.obj.field) fieldClassName += 'i-32-24 i-field-' + e.obj.field.base;
                    if (e.obj.type)
                        typeClassName += 'nav-item-icon ' + (e.obj.type.icon ? 'ic ic-' + e.obj.type.icon : 'i-32-24 ic i-setting-table');

                }
                t += `<div class='ex-finder-line'><div class='${typeClassName}'></div><div class=''>${e.table}.</div><div class='${fieldClassName}'>${e.field} : ${e.name}</div><div style='color:grey; padding-left:10px'>${bolding(e.caption, keyword)}</div></div>`;
            })
            return t;
        }
    }

})();




debugger;


