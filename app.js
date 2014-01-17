// Express
var express = require('express');
require('ejs');

var app = express();
var path = require('path');

// On spécifie le dossier dans lequel seront stockées les ressources statiques (css, js, ...)
app.use(express.static(path.join(__dirname, 'public')));

// appel à une bibliothèque de Node.js, ici la bibliothèque "http" qui nous permet de créer un serveur web"
var http = require('http');

// Récupérer la page demandée par le visiteur
var url = require("url");

// Récupérer les paramètres dans l'url
var querystring = require('querystring');

// Connexion à la base de données
var pg = require('pg');
var conString = "postgres://musicbrainz@192.168.56.101:5432/musicbrainz";

var sitename = "MusicBrainz App'";
function inArray(element, array) {
    for(var i = 0; i < array.length; i++) {
        if(array[i] == element) return true;
    }
    return false;
}

var afficherArtiste = function (res,req){

	var client = new pg.Client(conString);
	/* On récupère les parammètres dans l'url*/
	var params = querystring.parse(url.parse(req.url).query);
	var titre = params['titre'].replace("'", "''");

	/* Connexion à la base de données*/
	client.connect(function(err) {
	  if(err) {
	    return console.error('could not connect to postgres', err);
	  }
	  /* Requête*/
	    client.query('WITH all_works AS ( ' + /* trouver l'id de la chanson dans 'work' par rapport au titre */
	    				'SELECT id ' +
	    				'FROM work ' +
	    				'WHERE UPPER(name) = UPPER(\'' + titre + '\') ' + ')' +
					', all_recordings_works AS ( ' + /* trouver les reprises  par rapport aux originales */
							'SELECT entity0 ' +
							'FROM l_recording_work ' +
							'WHERE entity1 IN (SELECT id FROM all_works)) ' +
					', all_recordings AS ( ' + /* trouver l'id de l'artiste pour la reprise */
							'SELECT id, artist_credit ' +
							'FROM recording ' +
							'WHERE id IN (SELECT entity0 FROM all_recordings_works)) ' +
					'SELECT DISTINCT (artist_credit.name, artist.name, l_recording_work.entity1) ' + /* trouver le nom de l'artiste des reprises et l'Ã©crivain pour les originales */
					'FROM artist_credit INNER JOIN all_recordings ON all_recordings.artist_credit = artist_credit.id ' +
					'INNER JOIN l_recording_work ON l_recording_work.entity0 = all_recordings.id ' +
					'INNER JOIN l_artist_work ON l_recording_work.entity1 = l_artist_work.entity1 ' +
					'INNER JOIN artist ON artist.id = l_artist_work.entity0 ' +
					'WHERE artist_credit.id IN (SELECT artist_credit FROM all_recordings) ' + ';', function(err, result) {
	    if(err) {
	    	client.end();
	      	return console.error('error running query', err);
	    }
	    client.end();


		/* Création d'un tableau associatif entre les artistes qui ont repris la chanson et celui qui l'a écrite */
		var tabResult = new Array();

		if (result.rowCount != 0){
			var tabResult = new Array();

	          for (var i = 0; i < result.rowCount; i++) {
	            var row = result.rows[i].row;
	            var rowSplit = row.split(",");
	            var artistName = rowSplit[0].replace("(", "").replace("\"", "").replace("\"", "");
	            var WorkWritter = rowSplit[1].replace(")", "").replace("\"", "").replace("\"", "");
	            var idWork = rowSplit[2].replace(")", "");


	            if (tabResult[idWork] == null) {
	              tabResult[idWork] = new Array("Writters", "Artists");
	              tabResult[idWork]["Writters"] = new Array();
	              tabResult[idWork]["Artists"] = new Array();
	            }
	            if (inArray(WorkWritter, tabResult[idWork]["Writters"]) == false) {
	              tabResult[idWork]["Writters"].push(WorkWritter);
	            }
	            tabResult[idWork]["Artists"].push(artistName);

	          }
			res.render('reprises.ejs',{resultat: tabResult, titre: params['titre'], title: "Reprises de la chanson recherchée - " + sitename});
		} else {
			/*Traitement si la requête ne renvoie pas de résultat : il n'existe pas de reprise*/
			res.render('noReprise.ejs', {title:"Erreur de reprise - "+sitename, titre: params['titre']});
		}
	  });
	});
}



var makeXml = function() {
    var client = new pg.Client(conString);
    /* Connexion Ã  la base de donnÃ©es*/
    client.connect(function(err) {
      if (err) {
        return console.error('could not connect to postgres', err);
      }

      /* RequÃªte*/
      client.query('SELECT xmlforest(name) FROM work;', function(err, result) {
        if (err) {
          client.end();
          return console.error('error running query', err);
        }
        client.end();
        /*ActiveXObject n'est supporté que par Internet Explorer pour des questions de sécurité, nous n'avons pas réussi à le faire fonctionner */
        var fileSystem = new ActiveXObject("Scripting.FileSystemObject");
        fileSystem.CreateTextFile("name_work.xml", false);
        var monfichier = fileSystem.OpenTextFile("name_work.xml", 2, true);

        for (var i = 0; i < result.rowCount; i++) {

          monfichier.WriteLine(result.rows[i].xmlforest + "\n");
        }

        monFichier.Close();

      });
    });
  }





/* Traitements des différentes pages */
app.get('/', function(req, res) {
    res.render('accueil.ejs', {title:"Accueil - " + sitename});
})
.get('/reprises', function(req, res) {
	afficherArtiste(res, req);
})
.use(function(req, res, next){
	res.status(404);
	res.render('error404.ejs', {status: 404, title: "Erreur 404 - " + sitename});
});

app.listen(8080);