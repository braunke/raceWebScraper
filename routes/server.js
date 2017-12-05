var express = require('express');
var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var moment = require('moment');
var app     = express();
const pg = require('pg');
const conString = 'postgres://kayla:Hank@localhost/postgres';
var pool = new pg.Pool();

app.get('/', function(req, res){

    for (var pageNum = 1; pageNum < 11; pageNum++) {
        url = 'http://www.runningintheusa.com/Race/List.aspx?State=MN&Page=' + pageNum;
        var pagesDone = 0;
        var pagesErrored = 0;
        request(url, function(error, response, html){
            if(!error){
                var $ = cheerio.load(html)
                var table = $('.horizontalcssmenu table');
                var tablerows = table.find('.MenuGridViewRow, .MenuGridViewAlternatingRow');
                var placeholderArray = [];
                var values = [];
                tablerows.each(function(index) {
                    var race = {
                        date: moment($(this).find('td:nth-of-type(2) > div:nth-of-type(3)').text(), 'MMM D, YYYY'),
                        name: $(this).find('td:nth-of-type(3) > a').text(),
                        city: $(this).find('td:nth-of-type(4) > a').text(),
                        extId: parseInt(/\d+/.exec($(this).find('td:nth-of-type(5) > div > a').attr('href'))[0])
                    };
                    var placeholders = [1, 2, 3, 4, 5];
                    var types = ['text', 'date', 'text', 'text', 'integer'];
                    var phIndex = index * placeholders.length;
                    placeholders = placeholders.map(function(val, index) {
                        return 'cast($' + (phIndex + val) + ' as ' + types[index] + ')';
                    });
                    placeholderArray.push('(' + placeholders.join(', ') + ')');
                    values.push(race.name, race.date.format('MM/DD/YYYY'), null, race.city, race.extId);
                });
                if (values.length) {
                    var query =
                    ' with data(racename, racedate, racelink, racelocation, siteid) as ( ' +
                    '  values ' + placeholderArray.join(', ') + ' ' +
                    ' ) ' +
                    ' INSERT INTO races (racename, racedate, racelink, racelocation, siteid) ' +
                    ' select d.racename, d.racedate, d.racelink, d.racelocation, d.siteid ' +
                    ' from data d ' +
                    ' where not exists ( ' +
                    '  select 1 ' +
                    '  from races r ' +
                    '  where r.siteid = d.siteid ' +
                    ' )';
                    pool.connect(function(err,client,done){
                        if(err){
                            console.log("not able to get connection " + err);
                            res.send('whoops');
                        }
                        client.query(query, values, function (err,result) {
                            if (err) {
                                console.log(err);
                                pagesErrored++;
                            }
                            else {
                                pagesDone++;
                            }
                            doneWithPage();
                        })
                    });
                }
                function doneWithPage() {
                    var pagesReporting = pagesErrored + pagesDone;
                    console.log(pagesReporting + ' pages complete...');
                    if (pagesReporting == 10) {
                        if (pagesErrored) {
                            res.send('whoops');
                        } else {
                            res.send('done');
                        }
                    }
                }
            } else {
                console.log('maybe');
                res.send('whoops');
            }
        })
    }
})

app.listen('8081')

console.log('Magic happens on port 8081');

exports = module.exports = app;