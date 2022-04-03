var Version = '1.00 beta';

window.exEvalJS = (function () {

    //get the address of the Eval function of NinoxScript
    var evalFunctor = queries.getFunctor('eval', [{ sign: function () { return 'string' } }, { sign: function () { return 'nid' } }]);

    //get the execution context of the NinoxScripts
    var Ctx = new queries.JSRuntimeContext();

    //setting up the hook function
    if (evalFunctor && Ctx /* && !evalFunctor.oldFunction*/) {
        //save the old eval function, the one with the parameters eval(string,nid)
        if (evalFunctor.argTypes[0] == 'string') {
            evalFunctor.oldFunction = Ctx.F[evalFunctor.functorId];
        }


        //initialization of new parameter types: eval(any,any)
        evalFunctor.argTypes[0] = 'any';
        evalFunctor.argTypes[1] = 'any';
        evalFunctor.sign = 'eval(any,any)';

        //creation of the new extended function table
        evalFunctor.exFunctions = {};

        //add extended functions to the array
        evalFunctor.exFunctions['exEvalJS'] = exEvalJS;
        evalFunctor.exFunctions['exComments'] = exComments;

        /*
            Implementation of the new function eval in the Ninox functions array.
            Now the eval function can be called in two ways.
            1 - In the case of a call to the original eval function:
        
                fnt: Ninox code to be evaluated.
                params: Current record (this) which will be used as a context to evaluate the fnt code.
        
            2 - In the case of a call to the extended functions:
                fnt: string that contains either the name of the extended function.
                params : object which contains the parameters of the extended functions call.
        
            in both cases :
                db : database object.
                ret : function to call at the end of the function. The functions are called by stacking. When the first one is finished, it calls the next one.
            
            */

        evalFunctor.hook = function (fnt, params, db, ret) {
            try {
                //search if the first parameter of the eval function strictly contains the name of an extended function
                if (evalFunctor.exFunctions[fnt]) {
                    //if this is the case, the corresponding function is called
                    evalFunctor.exFunctions[fnt](fnt, params, db, ret);
                } else {
                    //If not, the Ninox function is called
                    evalFunctor.oldFunction(fnt, params, db, ret);
                }
            } catch (err) {
                //in case of an error, the error message is returned through the 'ret' return function
                ret(String(err.message));
            }
        };

        //recording the hooked function in the NinoxScript function array
        Ctx.F[evalFunctor.functorId] = evalFunctor.hook;
    }



    /*
    extended function that allows the execution of JavaScript code
    eval('exEvalJS', {javascript:, arguments:{param1:, param2:...}})
        javascript : string that contains the code to be executed
        arguments : {
                    param1, 
                    param2… : parameters passed to the code as arguments to a function
                    }
     
    return : result of JavaScript fonction.
     
    exemple :eval('exEvalJS', {
                                javascript: 'return a + b;',
                                arguments : {
                                            a: 10,
                                            b: 20
                                            }  
                            });
    result -> 30;
    
    important: for an asynchronous function, call cb('return value') rather than return 'return value'
                            
        exemple : promise.then( (value) => {
                                            cb(value);
                                            } ).then();
    
    */
    function exEvalJS(fnt, params, db, cb) {

        try {
            var { javascript, arguments } = params;
            var head = `var {${Object.keys(arguments).join(',')}} = args;`;
            var all = head + '\n' + javascript;
            var fn = Function('args', 'cb', all,);
            try {
                var Result = fn(arguments, cb);
                //check if function use CallBack to return result asynchronously
                if (javascript.search(/\b(cb)\b/) < 0)
                    return cb(Result);
            } catch (err) {
                var msgErr =
                    err.message + ' à la ligne ' + err.line - 2 + ', colonne ' + err.column;
                return cb(err)
            }
        } catch (err) {
            var msgErr =
                err.message + 'exEvalJS : à la ligne ' + err.line + ', colonne ' + err.column;

            cb(msgErr);
        }
    };

    /*
    getting the list of comments of a record
    eval('exComments', {id:} )
    return array of JSON with :
        comment : string of comment,
        userId : id of user post the comment,
        date : date of post in milli seconde.
    
    exemple : eval('exComments', this.id);
    result -> {comment:... ,userId:..., date:167533002 }
    */
    function exComments(fnt, params, db, cb) {

        database.loadComments(exUtils.getId(params), function (error, commentsArray) {
            if (error)
                cb('exComments : ' + error);
            else {
                var commentsList = [];
                for (num in commentsArray) {
                    var o = {
                        comment: commentsArray[num][2],
                        userId: commentsArray[num][1],
                        date: new Date(commentsArray[num][0]),
                    };
                    commentsList.push(o);
                }

                cb(commentsList);
            }
        });
    }
    return {
    }
})();

exModules.log(`EvalJS version ${Version} loaded`)


