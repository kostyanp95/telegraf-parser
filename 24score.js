const Telegram = require('telegraf/telegram')
const token = '';
const receivers = [id, id, id];

const bot = new Telegram(token);

function SendInfo(match_info, link) {
    for (let chat_id of receivers) {
        bot.sendMessage(chat_id, "24-24, первый сет\n" + 
        match_info + "\n<a href='" + link + "'>Ссылка на матч</a>", {
            parse_mode : "HTML"
        });
    }
}

const {Builder, By, Key, until} = require('selenium-webdriver');

var firefox = require('selenium-webdriver/firefox');

var options = new firefox.Options();
options.addArguments("-headless");

var driver;

const fs = require('fs');

const log_fname = 'log.txt';

function ConsoleLog(str) {
    var time = (new Date()).toLocaleString(undefined, {
        timeZone : "Europe/Moscow",
        hour12 : false
    });
    fs.appendFileSync(log_fname, '[' + time + ']' + ' ' + str + '\n');
}

Run = async function() {
    driver = await new Builder().forBrowser('firefox').setFirefoxOptions(options).build();
    
    async function Open(url) {
        try {
            await driver.get(url);
            ConsoleLog("URL Loaded. Waiting 20 seconds");
            await driver.sleep(20000);
        } catch(error) {
            await driver.quit();
            ConsoleLog(error);
        }
    }

    function FileLog(filename, str) {
        fs.writeFile(filename, str, function(err) {
            if (err) {
                return ConsoleLog(err);
            }
        });
    }
    
    var delim = '|';
    var db_filename = "links.db"
    function InitSet() {
        var data = fs.readFileSync(db_filename, "utf-8");
        var arr = data.split(delim);
        if (arr.length < 2) {
            return new Set();
        } else {
            return new Set(arr.slice(1));
        }
    }
    
    var link_set = InitSet();
    
    function HasLink(str) {
        return link_set.has(str);
    }
    
    function AddLink(str) {
        link_set.add(str);
        fs.appendFileSync(db_filename, delim + str);
    }

    function ScoreDump() {
        td = [];
        document.querySelectorAll("a.table__match-title-text").forEach(function(elem){
            td.push(elem.parentElement.parentElement);
        });
        scores = [];
        texts = [];
        href = [];
        td.forEach(function(elem) {
            score_elem = elem.querySelector(".table__score-more");
            text_elem = elem.querySelector("h3.table__match-title-text");
            href_elem = elem.querySelector("a.table__match-title-text");
            if (score_elem && text_elem && href_elem) {
                scores.push(score_elem.innerHTML);
                texts.push(text_elem.innerHTML);
                href.push(href_elem.href);
            }
        });
        return [scores, texts, href];
    }

    async function ScoreLog(filename, data) {
        var [scores, texts, href] = data;
        fs.appendFileSync(filename, (new Date()).toLocaleString(undefined, {
            timeZone : "Europe/Moscow",
            hour12 : false
        }) + '\n');
        for (let i = 0; i < scores.length; i++) {
            fs.appendFileSync(filename, texts[i] + ' : ' + scores[i] + '\n');
            fs.appendFileSync(filename, href[i] + '\n');
        }
        fs.appendFileSync(filename, '\n');
    }
    
    function RegTest(str) {
        var reg = /\( *(?:([0-9]{1,2})\*?-([0-9]{1,2})\*? *)(?:([0-9]{1,2})\*?-([0-9]{1,2})\*? *)?(?:([0-9]{1,2})\*?-([0-9]{1,2})\*? *)?(?:([0-9]{1,2})\*?-([0-9]{1,2})\*? *)?(?:([0-9]{1,2})\*?-([0-9]{1,2})\*? *)?\).*/;
        var points = reg.exec(str);
        if (points[1] && points[2]) {
            if ((points[1] >= 24) && (points[2] >= 24)) {
                return true;
            }
        }
        return false;
    }
    
    function HrefTest(str) {
        var starts_with = 'https://www.fonbet.ru/#!/live/volleyball';
        return str.startsWith(starts_with);
    }
    
    var sent_links = new Set();
    
    async function ScoreTest(data) {
        var [scores, texts, href] = data;
        for (let i = 0; i < scores.length; i++) {
            if (RegTest(scores[i]) && HrefTest(href[i])) {
                if (!HasLink(href[i])) {
                    SendInfo(texts[i] + " : " + scores[i], href[i]);
                    AddLink(href[i]);
                }
            }
        }
    }
    
    score_url = 'https://www.fonbet.ru/#!/live/volleyball';
    while (true) {
        await Open(score_url);
        var my_url = await driver.getCurrentUrl();
        ConsoleLog(my_url);
        if (my_url != score_url) {
            ConsoleLog("URLs don't match");
            await driver.sleep(300000);
        } else {
            break;
        }
    }
    
    //Restart every 20 mins
    var load_interval = 15
    
    for (let i = 0; i < 1200; i += load_interval) {
        var fetched = false;
        var my_url = await driver.getCurrentUrl();
        ConsoleLog(my_url);        
        (async function (){
            try {
                var scores = await driver.executeScript(ScoreDump);
                ScoreTest(scores);
                ScoreLog('scores.txt', scores);
                ConsoleLog("Got " + scores[0].length + " scores");
            } catch(error) {
                ConsoleLog(error);
                throw error;
            }
        })().then(function(){
            fetched = true;
        }, function(){
            throw new Error("Error while retrieving data from site");
        });
        await driver.sleep(load_interval * 1000);
        ConsoleLog((i+load_interval) + " seconds passed");
        if (!fetched) {
            break;
        }
    }
}

loop = async function() {
    try {
        await Run();
    } catch(error) {
        ConsoleLog(error);
        if (driver) {
            await driver.quit();
        }
    }
}

fs.writeFileSync('scores.txt', '');

loop();
