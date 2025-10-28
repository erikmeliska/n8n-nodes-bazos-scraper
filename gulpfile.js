const gulp = require('gulp');
const svgmin = require('gulp-svgmin');

const buildIcons = () => {
	return gulp
		.src('nodes/**/*.svg')
		.pipe(svgmin())
		.pipe(gulp.dest('dist/nodes'));
};

const build = gulp.series(buildIcons);

module.exports = { buildIcons, build };
