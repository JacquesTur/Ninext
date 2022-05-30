var exButtonEventVersion = '1.00b beta';

debugger;
window.exButtonEvent = (function () {
    var myInterval = setInterval(() => {
        var button = document.getElementsByClassName("component editor button");
        if (button && button.length > 0) {
            button.forEach(cpn => {
                var Bu = $(cpn).data().component;

                if (Bu && Bu.field && Bu.field.base == "button" && !Object.getPrototypeOf(Bu).exOldClick) {

                    Object.getPrototypeOf(Bu).exOldupdateVisibility = Object.getPrototypeOf(Bu).updateVisibility;
                    Object.getPrototypeOf(Bu).updateVisibility = function (e) {
                        this.exOldupdateVisibility(e);

                        if (this.field.visibility) {
                            var fn = exUtilsNx.extractNxFonctionInScript("onUpdate", this.field.visibility, this.field);
                            if (fn) {
                                fn += `; onUpdate({ caption: "${this.field.caption}", buttonColor : "${this.field.buttonColor}"})`;
                                var buttonValues = exUtilsNx.fireEval(fn, this.container.container.nid);
                                const colors = ['blue', 'red', 'grey']
                                debugger;
                                console.log('bouton', buttonValues);
                                if (buttonValues && buttonValues.caption)
                                    this.button.text(buttonValues.caption);

                                if (buttonValues && buttonValues.buttonColor && colors.includes(buttonValues.buttonColor)) {
                                    colors.forEach(c => this.button.removeClass(c));
                                    this.button.addClass(buttonValues.buttonColor);
                                }
                                if (buttonValues && buttonValues.title)
                                    this.el[0].title = buttonValues.title;

                            }
                        }
                    }

                    clearInterval(myInterval);
                    //alert('hook en place');
                }
            });
        }
    }, 1000);
    return {
        version: exButtonEventVersion,
    }
})()