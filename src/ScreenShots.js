const puppeteer = require('puppeteer');
const fs = require('fs');
const PNG = require('pngjs').PNG;
const pixelmatch = require('pixelmatch');
const path = require('path');

class ScreenShotTest {

    clearDirs = true;
    initialPageWidth = 1920;
    baseUrl = "http://localhost:3000";
    pageList = [
        {
            name: "index",
            page: ""
        }
    ];

    testDir = "__tests__";
    beforeDir = '/before/';
    afterDir = '/after/';
    diffDir = '/difference/';

    workReport = {
        timeMod: 0,
        baseUrl: "",
        devices: [],
        pagesList: []
    }

    constructor(options = {}) {
        if (options.initialPageWidth !== undefined) {
            this.initialPageWidth = options.initialPageWidth;
        }

        if (options.baseUrl !== undefined) {
            this.baseUrl = options.baseUrl;
        }
        if (options.pageList !== undefined) {
            this.pageList = options.pageList;
        }
        if (options.testDir !== undefined) {
            this.testDir = options.testDir;
        }

        if (options.beforeDir !== undefined) {
            this.beforeDir = options.beforeDir;
        }
        if (options.afterDir !== undefined) {
            this.afterDir = options.afterDir;
        }
        if (options.diffDir !== undefined) {
            this.diffDir = options.diffDir;
        }

        this.beforeDir = this.testDir + this.beforeDir;
        this.afterDir = this.testDir + this.afterDir;
        this.diffDir = this.testDir + this.diffDir;

        if (options.clearDirs !== undefined) {
            this.clearDirs = options.clearDirs;
        }

    }

    createAllDir = () => {
        if (!fs.existsSync(this.testDir)) {
            fs.mkdirSync(this.testDir);
        }
        if (!fs.existsSync(this.beforeDir)) {
            fs.mkdirSync(this.beforeDir);
        }
        if (!fs.existsSync(this.afterDir)) {
            fs.mkdirSync(this.afterDir);
        }
        if (!fs.existsSync(this.diffDir)) {
            fs.mkdirSync(this.diffDir);
        }

        if (!fs.existsSync(this.beforeDir + this.initialPageWidth + "/")) {
            fs.mkdirSync(this.beforeDir + this.initialPageWidth + "/");
        }
        if (!fs.existsSync(this.afterDir + this.initialPageWidth + "/")) {
            fs.mkdirSync(this.afterDir + this.initialPageWidth + "/");
        }
        if (!fs.existsSync(this.diffDir + this.initialPageWidth + "/")) {
            fs.mkdirSync(this.diffDir + this.initialPageWidth + "/");
        }

    }

    initDiskPrepeat = () => {
        this.createAllDir();

        if (fs.existsSync(this.beforeDir)) {
            fs.readdir(this.beforeDir, (err, files) => {
                for (const file of files) {
                    fs.unlink(path.join(this.beforeDir, file), err => {
                    });
                }
            });
        }
    }


    filterIt = (obj, searchKey) => {
        return Object.values(obj).findIndex((element, index, array) => {
            return element === searchKey;
        });
    }

    doneReading = async (img1, img2, options) => {
        let diffPNG = new PNG({width: img1.width, height: img1.height});
        pixelmatch(img1.data, img2.data, diffPNG.data, img1.width, img1.height, {threshold: 0.1, includeAA: false});

        let res = this.filterIt(diffPNG.data, 0); //res == 1 - есть различия, res == -1 - различий нет

        if (res !== -1) {
            let diffPNGFileName = this.diffDir + this.initialPageWidth + "/" + options.pageInfo.name + options.timeMod + '.png'
            await diffPNG.pack().pipe(await fs.createWriteStream(diffPNGFileName));
        }

        //console.log(options.pageInfo.name + ' ---- page compared');
        return res;
    }

    parsed = async (pageInfo, index, options) => {
        options.pageInfo = pageInfo;
        return await this.doneReading(options.img1, options.img2, options)
    }

    parse2 = async (pageInfo, index, options) => {

        //let timeMod = options.timeMod;

        let fileBefore = this.beforeDir + this.initialPageWidth + "/" + pageInfo.name + '.png';
        let resExist = fs.existsSync(fileBefore)
        if (resExist) {
            let data = fs.readFileSync(fileBefore);
            options.img2 = PNG.sync.read(data); //this.img2[index] =
        } else {
            let imagePNG = options.img1;//this.img1[index];
            let PNGOptions = {};
            let buffer = PNG.sync.write(imagePNG, PNGOptions);
            fs.writeFileSync(fileBefore, buffer);

            options.img2 = options.img1;
        }

        return await this.parsed(pageInfo, index, options);
    }

    diffPNG = async (timeMod) => {
        let result = [];

        let browser = await puppeteer.launch();
        const page = await browser.newPage();

        for (let index in this.pageList) {
            let pageInfo = this.pageList[index];

            await page.setViewport({width: this.initialPageWidth, height: 0});
            await page.goto(this.baseUrl + '/' + pageInfo.page);
            await page.screenshot({
                path: this.afterDir + this.initialPageWidth + "/" + pageInfo.name + '.png',
                fullPage: true
            });
            let data = fs.readFileSync(this.afterDir + this.initialPageWidth + "/" + pageInfo.name + '.png');
            this.img1 = PNG.sync.read(data);

            let PageDifferent = await this.parse2(pageInfo, index, {timeMod: timeMod, img1: this.img1});
            result[index] = PageDifferent;
        }

        await browser.close();
        return result;
    }

    initCompareDisk = () => {
        this.createAllDir();

        let clearDir = [this.diffDir, this.afterDir, this.testDir + '/']
        clearDir.map(function (element, index) {
            if (fs.existsSync(element)) {
                fs.readdir(element, (err, files) => {
                    for (const file of files) {
                        fs.unlink(path.join(element, file), err => {
                        });
                    }
                });
            }
        });
    }

    createReport = (resultScreenshots, timeMod) => {
        //console.log(resultScreenshots);

        let result = {
            "baseURL": this.baseUrl,
            "testDir": this.testDir,
            "beforeDir": this.beforeDir,
            "afterDir": this.afterDir,
            "diffDir": this.diffDir,
            "initialPageWidth": this.initialPageWidth,
            "timeMod": timeMod
        };

        let compareList = resultScreenshots.map((resultScreenshot, index) => {
            let screenshot = {
                diff: resultScreenshot
            };
            screenshot.pageInfo = Object.assign({}, this.pageList[index]);
            return screenshot;
        });

        let objectList = this.pageList.map((pageInfo, index) => {
            pageInfo.diff = resultScreenshots[index];
            return pageInfo;
        });


        result.pageList = objectList;
        result.compareList = compareList;

        return result;
    }

    compareTask = async () => {
        if (this.clearDirs) {
            this.initCompareDisk();
        }

        let timeMod = new Date().getTime();

        let resultScreenshots = await this.diffPNG(timeMod);

        let result = this.createReport(resultScreenshots, timeMod);
        return result;
    };


    initTask = async () => {
        this.initDiskPrepeat();

        const browser = await puppeteer.launch();

        for (let index in this.pageList) {
            let element = this.pageList[index];

            const page = await browser.newPage();
            await page.setViewport({width: this.initialPageWidth, height: 0});
            await page.goto(this.baseUrl + '/' + element);
            await page.screenshot({path: this.beforeDir + element + '.png', fullPage: true});
            console.log(element + ' page +');
        }

        await browser.close();
    }

    main = async (type) => {
        if (type === "initTask") {
            await this.initTask();
        } else {
            await this.compareTask();
        }
    }
}

module.exports = ScreenShotTest;