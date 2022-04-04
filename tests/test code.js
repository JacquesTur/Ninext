var fileModule = new XMLHttpRequest();
fileModule.addEventListener('load', function () {
    if (this.readyState == 4)
        if (this.status == 200)
            $callback(this.responseText);
        else
            $callback(this.responseText);

});
fileModule.addEventListener('error', function (e) {
    cb('error : Request error with status' + e.target.status + ' !');
});
fileModule.open('GET', address, true);
fileModule.send();