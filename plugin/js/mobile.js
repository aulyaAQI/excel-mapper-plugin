/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/js/mobile.js":
/*!**************************!*\
  !*** ./src/js/mobile.js ***!
  \**************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n(function (PLUGIN_ID) {\n  kintone.events.on('mobile.app.record.index.show', () => {\n    const spaceEl = kintone.mobile.app.getHeaderSpaceElement();\n    if (spaceEl === null) {\n      throw new Error('The header element is unavailable on this page.');\n    }\n\n    const fragment = document.createDocumentFragment();\n    const headingEl = document.createElement('h3');\n    const messageEl = document.createElement('p');\n\n    const config = kintone.plugin.app.getConfig(PLUGIN_ID);\n    messageEl.textContent = config.message;\n    messageEl.classList.add('plugin-space-message');\n    headingEl.textContent = 'Hello kintone plugin!';\n    headingEl.classList.add('plugin-space-heading');\n\n    fragment.appendChild(headingEl);\n    fragment.appendChild(messageEl);\n    spaceEl.appendChild(fragment);\n  });\n})(kintone.$PLUGIN_ID);\n\n\n//# sourceURL=webpack://excel_mapper/./src/js/mobile.js?");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The require scope
/******/ 	var __webpack_require__ = {};
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = {};
/******/ 	__webpack_modules__["./src/js/mobile.js"](0, __webpack_exports__, __webpack_require__);
/******/ 	
/******/ })()
;