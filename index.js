const fs = require("fs");
const chromeLauncher = require('chrome-launcher');
const http = require('http');
const staticN = require('node-static');

const ScreenShotTest = require("./src/ScreenShots");
const requirement = require("./requirement.json");
const {copyFileSync} = require("fs");

let SERVER = {};
SERVER["HTTP_PROTOCOL"] = 'http';
SERVER["HTTP_HOST"] = 'localhost';
SERVER["SERVER_PORT"] = 3001;

let generateStandartOptions = async (requirement) => {

    let defaultOptions = {
        "baseURL": requirement.baseURL,
        "testDir": requirement.testDir,
        "beforeDir": requirement.beforeDir,
        "afterDir": requirement.afterDir,
        "diffDir": requirement.diffDir,
    }

    let resultList = {};

    let pageWidths = requirement.pageWidths;
    let pageList = requirement.pageList;

    for (let index in pageWidths) {
        let pageWidth = pageWidths[index];

        let nameOption = "" + pageWidth.width;
        resultList[nameOption] = {};
        Object.assign(resultList[nameOption], defaultOptions);
        resultList[nameOption].initialPageWidth = pageWidth.width;

        resultList[nameOption].pageList = [];
        for (let pageIndex in pageList) {
            let page = pageList[pageIndex];
            if ((page.pageWidth === undefined) || (page.pageWidth === pageWidth.width)) {
                resultList[nameOption].pageList.push(page);
            }
        }
    }

    let fullJson = {
        "baseURL": requirement.baseURL,
        "testDir": requirement.testDir,
        "beforeDir": requirement.beforeDir,
        "afterDir": requirement.afterDir,
        "diffDir": requirement.diffDir,
        "List": {},
        "ErrorList": {}
    };

    for (let key in resultList) {
        let options = resultList[key];
        let screenShotTest = new ScreenShotTest(options);
        let jsonInfo = await screenShotTest.compareTask().catch((err) => {
            console.log(err);
        });
        console.log(jsonInfo);

        for (let resKey in jsonInfo.pageList) {
            let element = jsonInfo.pageList[resKey];

            if (element.diff > 0) {
                //Ошибка в странице
                fullJson.ErrorList['' + options.initialPageWidth] = fullJson.ErrorList['' + options.initialPageWidth] === undefined ? [] : fullJson.ErrorList['' + options.initialPageWidth];
                fullJson.ErrorList['' + options.initialPageWidth].push(Object.assign({timeMod: jsonInfo.timeMod}, element));
            } else {
                fullJson.List['' + options.initialPageWidth] = fullJson.List['' + options.initialPageWidth] === undefined ? [] : fullJson.List['' + options.initialPageWidth];
                fullJson.List['' + options.initialPageWidth].push(Object.assign({timeMod: jsonInfo.timeMod}, element));
            }
        }

    }

    let fileName = requirement.testDir + '/' + 'result.json';
    fs.writeFileSync(fileName, JSON.stringify(fullJson));

    //screenShotTest.main(process.argv[2]);
}


pathInfo = (fullfilename) => {
    let result = {};

    let ex = fullfilename.split("/");
    let maxExIndex = ex.length-1;
    let basename = ex[maxExIndex];
    result.basename = basename;

    ex.pop();//[maxExIndex] = undefined;
    let dirname = ex.join("/");
    result.dirname = dirname;

    ex = basename.split(".");
    maxExIndex = ex.length-1;
    let extension = ex[maxExIndex];
    result.extension = extension;

    ex.pop();//[maxExIndex] = undefined;
    let filename = ex.join(".");
    result.filename = filename;

    return result;
}

fileMove = (url) => {
    let path = url.split("/");
    let pageWidth = path[3];
    let fileName = path[4];

    let filePath = fileName.split(".");
    let name = filePath[0].substring(0, filePath[0].length-13); //demopage1637576647150


    let requirement = JSON.parse(fs.readFileSync("./requirement.json", 'utf8'));

    let defaultOptions = {
        "baseURL": requirement.baseURL,
        "testDir": requirement.testDir,
        "beforeDir": requirement.beforeDir,
        "afterDir": requirement.afterDir,
        "diffDir": requirement.diffDir,
    }

    //after >> before
    let after = requirement.testDir + requirement.afterDir + pageWidth + '/' + name + '.png';
    let before = requirement.testDir + requirement.beforeDir + pageWidth + '/' + name + '.png';

    let result = fs.copyFileSync(after, before);
    return result;
}

openHtmlServer = (requirement) => {
    let fileName = requirement.testDir + '/' + 'result.json';
    let objectJson = JSON.parse(fs.readFileSync(fileName, 'utf8'));

    let templateFilename = './src/template.html';
    let templateHtml = fs.readFileSync(templateFilename, 'utf8');

    let links = [];
    for (let key in objectJson.ErrorList) {
        let element = objectJson.ErrorList[key];

        for (let keyList in element) {
            let pageInfo = element[keyList];

            let pngName = key + '/' + pageInfo.name + pageInfo.timeMod + '.png'
            let imgPath = '/' + requirement.testDir + requirement.diffDir + pngName;
            let link = '<p>Страница <a target="_blank" href="'+requirement.baseURL+'/'+pageInfo.page+'">'+requirement.baseURL+'/'+pageInfo.page+
                '</a> скрин ошибки - <a target="_blank" href="' + imgPath + '">' + imgPath +
                '</a>  Заменить исходную страницу на текущую <a target="_blank" href="change/' + pngName + '">ДА</a></p>';
            links.push(link);
        }
    }

    //
    templateHtml = templateHtml.replace('{{ content }}', links.join("\n"));
    let htmlPath = requirement.testDir + '/index_test.html';
    fs.writeFileSync(htmlPath, templateHtml);


    //httpServerStart
    let fileServer = new staticN.Server( './',{ cache: false });
    http.createServer(function (req, res) {
        req.addListener('end', function () {
            let change = req.url.indexOf('/change/');
            if (change > 0) {
                fileMove(req.url);
                res.end("Change file");
            } else {
                fileServer.serve(req, res);
            }
        }).resume();
    }).listen(SERVER["SERVER_PORT"], () => {
        console.log(`Server start ${SERVER["HTTP_PROTOCOL"]}://${SERVER["HTTP_HOST"]}:${SERVER["SERVER_PORT"]}/`);
    });

    chromeLauncher.launch({
        startingUrl: `${SERVER["HTTP_PROTOCOL"]}://${SERVER["HTTP_HOST"]}:${SERVER["SERVER_PORT"]}/` + htmlPath,
        userDataDir: false
    }).then(chrome => {
        console.log(`Chrome debugging port running on ${chrome.port}`);
    });
}

let typeOpen = 0;
if (process.argv.length > 2) {
    if (process.argv[2] === "http") {
        typeOpen = 1;
    } else if (process.argv[2] === "open") {
        typeOpen = 2;
    }
}

if (typeOpen === 2) {
    openHtmlServer(requirement);
} else {
    generateStandartOptions(requirement).then(() => {
        if (typeOpen === 1) {
            // Generate html
            openHtmlServer(requirement);
        }
    });
}
