// Cucumber loads formatters via native import(), which bypasses the tsx/cjs hook
// registered by requireModule. require() goes through it, so the .ts loads here.
module.exports = require('./CucumberTTAFormatter.ts').default;
