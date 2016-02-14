Experimental

Neuralquest
===========

Neuralquest is a platform that covers all your business process needs.
It provides class, page, organization and process modellers as well as an execution environment.
Please visit [neuralquest.org](http://neuralquest.org) for details.

Install
-------

MonogDB:

0. Install [MongoDB](https://www.mongodb.org/) and [Mogochef](http://3t.io/mongochef/).
1. Create a directory called `C:\data\db\`.
3. Start MongoDB from a command prompt `C:\Program Files\MongoDB\Server\3.2\bin\mongod.exe`.
4. Start Mogochef and create a DB called 'neuralquest'.
5. Import the three collections from 'data': assocs, counters and items.

Clone Repository:

0. Install [Node.js](http://nodejs.org) .
1. Using GitBash, create a directory called `C:\Users\<user>\Git`.
2. Form the 'Git' directory clone the repository using `git clone --recursive https://github.com/Neuralquest/neuralquest.git`.
The '--recusive' parm will cause install of Dojo Toolkit submodules under 'public'.
3. From the 'neuralquest' directory run `npm install` to install Node.js dependencies.

Have fun!
