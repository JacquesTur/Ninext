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

reports.openDesigner({ nid: id, nids: records, reportName: report, printAllAndClose: true })


function onclick(event: any) do
    debug(string(event));
	debugValueInfo(event);
alert(---
    old ID : { event.oldID }, new ID : { event.newID }, line : { event.targetLine } col : { event.targetColumn }
---)
end onclick({ "oldID": "N3", "newID": "A4", "targetLine": 0, "targetColumn": {} })

