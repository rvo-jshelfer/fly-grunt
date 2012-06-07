/*global module:false*/

// Get the node "fs" module so we can check last modified timestamps of files.
var fs = require('fs');

// Create the grunt module.
module.exports = function(grunt) {
	// Project configuration.
	grunt.initConfig({
		lint: {
			files: ['Source/**/*.js', 'Tests/**/*.js']
		},
		qunit: {
			files: ['Tests/**/*.html']
		},
		build: {
			files: '<json:Settings/BuildLists/all.json>'
		},
		watch: {
			files: '<config:lint.files>',
			tasks: 'default'
		},
		jshint: {
			options: {
				boss: true,
				browser: true,
				curly: true,
				//devel: true,
				eqeqeq: true,
				eqnull: true,
				immed: true,
				latedef: true,
				newcap: true,
				noarg: true,
				smarttabs: true,
				sub: true,
				undef: true
			},
			globals: {}
		},
		uglify: {},
		custom: {
			properties: '<json:Settings/custom.properties.json>'
		}
	});
	
	// Custom tasks
	
	grunt.registerTask('build', 'Builds both the uncompressed and compressed versions of source files.', function() {
		// Get the list of files that have build instructions.
		var buildFiles = grunt.config.get('build')['files'];
		
		for(var i = 0; i < buildFiles.length; i++) {
			// Get the list of build instructions.
			var buildList = grunt.file.readJSON(buildFiles[i]);
			
			for(var build in buildList) {
				if(buildList.hasOwnProperty(build)) {
					// Prepare the src values.
					var tempSrc = null;

					if(typeof buildList[build] === 'string') {
						tempSrc = ['Source/' + buildList[build] + '.js'];
					} else if(typeof buildList[build] === 'object') {
						// Prepare every src value in the source file list.
						tempSrc = [];

						if(buildList[build] instanceof Array) {
							if(buildList[build].length) {
								for(var j = 0; j < buildList[build].length; j++) {
									tempSrc[j] = 'Source/' + buildList[build][j] + '.js';
								}
							}
						} else {
							if(buildList[build].path && buildList[build].files && buildList[build].files.length) {
								for(var j = 0; j < buildList[build].files.length; j++) {
									tempSrc[j] = 'Source/' + buildList[build].path + buildList[build].files[j] + '.js';
								}
							}
						}
					}

					// Check each source file to see if it changed since the file was last built.
					var srcChanged = false;
					var buildTimestamp = new Date(fs.statSync('Build/' + build + '.uncompressed.js').mtime).getTime();
					var k = 0;

					while(!srcChanged && k < tempSrc.length) {
						srcChanged = new Date(fs.statSync(tempSrc[k]).mtime).getTime() > buildTimestamp;
						k++;
					}

					// Prepare the dest values only if something in the source changed or if the file being built is a filelist.
					if(srcChanged || build.indexOf('Filelists') == 0) {
						var concatContent = grunt.helper('concat', tempSrc);
						concatContent = grunt.template.process(concatContent, {
							cacheBust: function(filePath) {
								var cacheBustPath = '';

								// Make sure a filepath was provided.
								if(filePath) {
									// Insert the file's last modified timestamp into the filepath.
									try {
										var modifiedDate = new Date(fs.statSync(filePath).mtime);
										cacheBustPath = grunt.template.date(Date.UTC(modifiedDate.getFullYear(), modifiedDate.getMonth(), modifiedDate.getDate(), modifiedDate.getHours(), modifiedDate.getMinutes(), modifiedDate.getSeconds()), 'yyyymmddhhMMss') + '/' + filePath;
									} catch(e) {
										grunt.log.writeln('ERROR: Failed to lookup modified timestamp for ' + filePath);
										grunt.log.writeln(e);
									}
								}

								return cacheBustPath;
							}
						});
						var minContent = grunt.helper('uglify', concatContent);

						grunt.file.write('Build/' + build + '.uncompressed.js', concatContent);
						grunt.file.write('Build/' + build + '.js', minContent);
					}
				}
			}
		}
	});
	
	grunt.registerTask('publish', 'Publishes everything in the "Build" folder to a jsdebug folder.', function(environment) {
		// Make sure the network drive custom property exists.
		var custom = grunt.config.get('custom');
		
		if(custom && custom.properties && custom.properties.networkDrive) {
			try {
				grunt.file.recurse('Build', function(abspath, rootdir, subdir, filename) {
					grunt.file.copy(abspath, custom.properties.networkDrive + '/html/rb/js/environments/' + (environment || custom.properties.personalEnvironment || 'dev') + '/' + rootdir + '/' + (subdir ? subdir + '/' : '') + filename);
				});
			} catch(e) {
				grunt.log.writeln('ERROR: Failed to publish build files');
				grunt.log.writeln(e);
			}
		} else {
			grunt.log.writeln('ERROR: Please specify a network drive in /Settings/custom.properties.json');
		}
	});

	// Default task
	grunt.registerTask('default', 'lint qunit build');
};
