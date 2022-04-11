var Version = '1.00 beta';

exFinder = (function () {
    const expsName = ["onClick", "beforeUpdate", "afterUpdate", "visibility", "canWrite", "beforeShow", "afterHide"];

    function getExpressions(obj) {

        var lst = [];

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
                    var name = c.caption ? c.caption : exp.toHumanString('', 0) ;
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

    function findInList(elements, f, ft) {
        var lst = []; var re = new RegExp('\\b' + f + '\\b', 'i'); for (var e in elements) {
            var element = elements[e]; if (element.caption.search(re) != -1) {
                var e = Object.assign(element);
                delete e.exp; lst.push(element);
            }
        } return lst;
    }

    function hmltFormat(lst) {
        var t = '';
        var f = '';
        lst.forEach((e) => {
            if (e.table != t) {

            }
        })
    }

    return {
        find: function (value, typeOfValue) {
            var lst = getFindElements();
            return findInList(lst, value, typeOfValue);

        }
    }
})();

exModules.log(`exFinder version ${Version} loaded`)






