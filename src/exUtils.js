exUtilsVersion = '1.01 beta';

window.exExpUtils = (function () {
  return {
    forEach(exp, fn) {
      if (!Array.isArray(exp)) {
        fn(exp);
        exp.getChildren().forEach(ch => {
          this.forEach(ch, fn);
        })
      }
      else
        exp.forEach(e => {
          e.getChildren().forEach(ch => {
            this.forEach(ch, fn);
          })
        })
    },

  }
})();

window.exUtilsNx = (function () {
  console.log("exUtilsNx.constructor");
  return {
    version: exUtilsVersion,
    test: function () {
      return "ok";
    },

    getId: function (record) {
      if (typeof record === "string") return record;
      else if (typeof record === "object") return record._id;
      else return null;
    },


    fireEval: function (fn, recordId) {
      try {
        console.log("fireEval(" + fn + ",\n" + recordId + ")");

        var type = database.typeOf(this.getId(recordId));
        var compile = queries.parseSystem(
          database.schema,
          type,
          unescape("(" + fn + ")"),
          {}
        );
        //            compile.flags ^= 16;
        //            compile.flags |= 16;
        if (compile.hasErrors())
          compile = queries.parseHuman(database.schema, type, unescape(fn), {});
        if (compile.hasErrors())
          return "Erreur d'expression : " + compile.errorMessage();
        var result = null;
        database.loadNode(recordId, function (e, i) {
          return e
            ? "Failed to load record: " + e
            : i
              ? compile.evaluate(database, i, function (error, t) {
                if (error) return result = "Failed to evaluate expression: " + error, result;
                return result = t, result;
              })
              : //? compile.evaluateSync(database, i)
              "Record not found: " + recordId;
        });
      } catch (err) {
        var msgErr =
          err.message + " à la ligne " + err.line + ", colonne " + err.column;

        return msgErr;
      }
      return result;
    },

    fireEvalGlobal: function (fn) {
      var result = "";
      try {
        var compile = queries.parseHuman(
          database.schema,
          null,
          unescape(fn),
          {}
        );

        if (compile.hasErrors())
          return "Erreur d'expression : " + compile.errorMessage();
        compile.evaluate(database, null, function (error, t) {
          if (error) return "Failed to evaluate expression: " + error;
          result = t;
          return t;
        });
      } catch (err) {
        var msgErr =
          err.message + " à la ligne " + err.line + ", colonne " + err.column;

        return msgErr;
      }
      return result;
    },

    fireExp: function (exp, recordId) {
      try {
        if (exp.hasErrors())
          return "Erreur d'expression : " + exp.errorMessage();
        var result = database.loadNode(recordId, function (e, i) {
          return e
            ? "Failed to load record: " + e
            : i
              ? exp.evaluate(database, i, function (error, t) {
                if (error) return "Failed to evaluate expression: " + error;
                return t;
              })
              : "Record not found: " + recordId;
        });
      } catch (err) {
        var msgErr =
          err.message + " à la ligne " + err.line + ", colonne " + err.column;

        return msgErr;
      }
      return result;
    },

    generateUniqueId: function (prefix) {
      var id = prefix.toString();
      var num = 0;
      while (document.getElementById(id)) {
        num++;
        id = prefix.toString() + num.toString();
      }
      return id;
    },

    findNxComponentFromElementId: function (elementId) {
      var component = $("#" + elementId);
      return component ? component.closest(".component") : void 0;
    },

    findNxCompomentData: function (component) {
      return component ? component.data("component") : void 0;
    },

    extractNxFonctionInScript: function (fnName, script, field) {
      debugger;
      var compile = queries.parseSystem(
        field.schema,
        field.type,
        unescape("(" + script + ")"),
        {}
      );
      //            compile.flags ^= 16;
      //            compile.flags |= 16;
      if (compile.hasErrors())
        compile = queries.parseHuman(field.schema, field.type, unescape(script), {});
      if (compile.hasErrors())
        return "Erreur d'expression : " + compile.errorMessage();

      var r = "";
      exExpUtils.forEach(compile, exp => {
        if (exp.base == "lambda" && exp.id == fnName)
          r = exp.toHumanString();
      })
      return r;
      // var r = null;
      // var s = script.toString().match("function " + fnName + ".*", "g");
      // if (s) {
      //   s = s.toString().match(/.[^\(|^\)]*/g);
      //   var p = 1;
      //   r = "";
      //   for (i in s) {
      //     if (s[i][0] == "(") p++;
      //     if (s[i][0] == ")") {
      //       p--;
      //       if (p <= 0) s[i] = s[i][0];
      //     }
      //     if (p <= 0) break;
      //     r += s[i];
      //   }
      // }
      // return r;

    },

    findNxFunctionInField: function (fnName, elementId) {
      var cpn = this.findNxComponentFromElementId(elementId);
      var dataField = this.findNxCompomentData(cpn);
      return dataField.field.fn
        ? this.extractNxFonctionInScript(fnName, dataField.field.fn, dataField.field)
        : void 0;
    },

    extractJSONValueInScript: function (varName, script) {
      var s = script.toString().match(`(var ${varName} := ).*`, 'gs');
      var s = s[0].toString().match('(\\{).*(\\})', 'gs');
      var value = this.fireEvalGlobal(s[0]);
      return value;
    },

    extractJSONValueInFieldFn: function (varName, elementId) {
      var cpn = this.findNxComponentFromElementId(elementId);

      var dataField = this.findNxCompomentData(cpn);
      if (cpn && dataField)
        return (dataField.field.fn
          ? this.extractJSONValueInScript(varName, dataField.field.fn)
          : void 0);
      else return void 0;
    },

    fireNxFunction: function (fnName, elementId) {
      var cpn = this.findNxComponentFromElementId(elementId);
      var data = cpn ? this.findNxCompomentData(cpn) : void 0;
      var fnScript = data.field.fn
        ? this.extractNxFonctionInScript(fnName, data.field.fn, data.field)
        : void 0;
      var recordId = data.container.container.nid ? data.container.container.nid : null;
      var fn = fnScript + ";\n" + fnName + "(";
      var a;
      for (let i = 2; i < arguments.length; i++) {
        a = arguments[i].valueOf();
        if (Number.isInteger(a)) fn += a;
        else fn += '"' + a + '"';

        if (i < arguments.length - 1) fn += ", ";
      }
      fn += ");";
      return this.fireEval(fn, recordId);
    },

    getIconClassName: function (Expr) {
      var iconClassName = Expr.base ? ('i-32-24 i-field-' + Expr.base) : '';
      if (Expr.type) {
        if (Expr.type.icon)
          iconClassName = 'nav-item-icon ic ic-' + Expr.type.icon;
        else
          iconClassName = 'i-32-24 i-field-view';
      }
      // NXTreeView_icon nav-item-icon i-32-24 i-white i-setting-table
      // i-32-24 i-light-grey i-field-view


      //class="fn-tools-field-icon i-grey i-32-24 i-field-view"
      //  class="fn-tools-field-icon i-QC nav-item-icon i-32-24 i-field-view"
      return iconClassName;
    }
  };
})();




