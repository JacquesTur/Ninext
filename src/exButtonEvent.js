var exButtonEventVersion = '1.00d beta';


exButtonBadges = {
    position: 'absolute',
    display: 'flex',
    top: '0px',
    right: '0px',
    'background-color': 'red',
    height: '15px',
    'line-height': '15px',
    width: 'auto',
    'min-width': '11px',
    'padding-left': '2px',
    'padding-right': '2px',
    'text-align': 'center',
    'border-radius': '8px',
    color: 'white',
    'justify-content': 'center',
    'font-size': 'smaller'
};

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
                               
                                console.log('bouton', buttonValues);
                                if (buttonValues && buttonValues.caption)
                                    this.button.text(buttonValues.caption);

                                if (buttonValues && buttonValues.buttonColor && colors.includes(buttonValues.buttonColor)) {
                                    colors.forEach(c => this.button.removeClass(c));
                                    this.button.addClass(buttonValues.buttonColor);
                                }
                                if (buttonValues && buttonValues.title)
                                    this.el[0].title = buttonValues.title;

                                var badge = this.button.find('span')[0];
                                if (buttonValues && buttonValues.badge) {

                                    if (!badge) {
                                        badge = $(document.createElement("span"));
                                        this.button.append(badge);
                                    }

                                    //set the badge
                                    badge.css(exButtonBadges);
                                    badge.text(buttonValues.badge.caption ? buttonValues.badge.caption : "")
                                    badge.css("visibility", (buttonValues.badge.caption && buttonValues.badge.caption.length > 0) ? 'visible' : 'hidden');
                                    badge.css("backgroundColor", buttonValues.badge.color ? buttonValues.badge.color : "red");
                                }
                                else
                                    if (badge) badge.css('visibility', false)
                            }
                        }
                    }

                    clearInterval(myInterval);
                    //alert('hook en place');

                    debugger;
                    Bu.updateVisibility();
                }
            });
        }
    }, 1000);
    return {
        version: exButtonEventVersion,
    }
})()