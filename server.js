 /******************************************************
 * PLEASE DO NOT EDIT THIS FILE
 * the verification process may break
 * ***************************************************/

'use strict';

var fs = require('fs');
var express = require('express');

var app = express();

if (!process.env.DISABLE_XORIGIN) {
  app.use(function(req, res, next) {
    var allowedOrigins = ['https://narrow-plane.gomix.me', 'https://www.freecodecamp.com'];
    var origin = req.headers.origin || '*';
    if(!process.env.XORIG_RESTRICT || allowedOrigins.indexOf(origin) > -1){
         console.log(origin);
         res.setHeader('Access-Control-Allow-Origin', origin);
         res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    }
    next();
  });
}

app.use('/public', express.static(process.cwd() + '/public'));

app.route('/_api/package.json')
  .get(function(req, res, next) {
    console.log('requested');
    fs.readFile(__dirname + '/package.json', function(err, data) {
      if(err) return next(err);
      res.type('txt').send(data.toString());
    });
  });


//To get default index
app.route('/')
    .get(function(req, res) {
		  res.sendFile(process.cwd() + '/views/index.html');
    })


//API for producing shortened URLs
app.get('/new/*', function(req, res) 
{
	var urlString = req.path;
	var urlBase = 'https://' + req.header('host') + '/';
	urlString = urlString.substring(urlString.indexOf('/new')+5);
  

  //Check if valid URL - This module picks up a good bit
  var validUrl = require('valid-url');
  console.log('Checking if valid URL:', urlString);
	if (validUrl.isWebUri(urlString))		
	{
    console.log('Connecting to DB');
		var MongoClient = require('mongodb').MongoClient;
		MongoClient.connect(process.env.dbURL, function(err, db) 	//connect to databse
		{
			if (err) 
			{
				res.end('{"error" : "Cannot connect to database."}');
				console.log("DB error - Connect - " + err);
			}
			else
			{
				var collection = db.collection("fcc-url-short");
				//Need to check if URL already exists.
				var query = {"original_url": urlString};
				console.log('Checking if URL is already inserted:', urlString);
				collection.find(query).toArray(function(err, searchRes) 
				{
					if (err) 
					{
						res.end('{"error" : "Cannot read database."}');
						console.log("DB error - Search -" + err); 
						db.close();						
					}
					else
					{
						var shortResult = { "original_url": "", "short_url": ""};
						var longResult = { "original_url": "", "short_url": ""};
						if (searchRes.length >0)
						{
							//URL already in database. No need to make new entry.
							longResult.original_url = searchRes[0].original_url;		
							longResult.short_url = urlBase + searchRes[0].short_url;
							res.end(JSON.stringify(longResult));
							console.log('URL already in database. No need to make new entry:', JSON.stringify(longResult));
						}
						else
						{
							//If not, we make a new entry
							
							longResult.original_url = urlString;
							shortResult.original_url = urlString;
							//Make a short, unique key
							var shortid = require('shortid');
							shortResult.short_url = shortid.generate();	//Just saving the shortid, because base URL may change.
							longResult.short_url =  urlBase + shortResult.short_url;
							console.log('Inserting new entry into DB: ', JSON.stringify(shortResult));
							collection.insert(shortResult, function(err, insertRes) 
							{
								if (err) 
								{
									res.end('{"error" : "Cannot write to database."}');
									console.log("DB error - Insert -" + err); 
								}
								else
								{
									
									
									res.end(JSON.stringify(longResult));
									console.log('Insert success.');
									
								}
								//db.close();
							}); 							
						}
					}
					db.close();
				});
              

            }
        });

        
        
	} 
	else 
	{
		res.end('{"error" : "Submitted invalid URL."}');
	}
      
});


//API for rerouting shortened URLS
app.get('/*', function(req, res) 
{
	var query = {"short_url" : req.path.substring(1)};
	//var urlBase = 'https://' + req.header('host') + '/';
	//urlString = urlString.substring(urlString.indexOf('/')+5);
	var MongoClient = require('mongodb').MongoClient;
	MongoClient.connect(process.env.dbURL, function(err, db) 	//connect to databse
	{
		if (err) 
		{
			res.end('{"error" : "Cannot connect to database."}');
			console.log("DB error - Connect - " + err);
		}
		else
		{	
			var collection = db.collection("fcc-url-short");
      console.log('Searching for:', JSON.stringify(query));
			collection.find(query).toArray(function(err, searchRes) 
			{
				if (err) 
				{
					res.end('{"error" : "Cannot read database."}');
					console.log("DB error - Search -" + err); 
					db.close();						
				}
				else
				{
					if(searchRes.length > 0)		//Found the DB entry
					{
						res.redirect(searchRes[0].original_url);
						console.log("Redirecting to:", searchRes[0].original_url);
					}
					else							//Didn't find the DB entry
					{
						res.end('{"error" : "Cannot find key:' + req.path.substring(1) +'"}');
						console.log("Error: Cannot find key:", req.path.substring(1));
					}
					db.close();							
						
				}
			});
		}
	});
});

// Respond not found to all the wrong routes
app.use(function(req, res, next){
  res.status(404);
  res.type('txt').send('Not found');
});

// Error Middleware
app.use(function(err, req, res, next) {
  if(err) {
    res.status(err.status || 500)
      .type('txt')
      .send(err.message || 'SERVER ERROR');
  }  
})

app.listen(process.env.PORT, function () {
  console.log('Node.js listening ...');
});

