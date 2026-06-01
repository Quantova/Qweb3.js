/// test.js
const fs = require('fs');
const path = require('path');

console.log("====================================================");
console.log("      Quantova Enterprise SDK Global Test Suite     ");
console.log("====================================================\n");

const testsDir = path.join(__dirname, 'tests');
const testFiles = fs.readdirSync(testsDir).filter(file => file.endsWith('.test.js')).sort();

(async () => {
  let successCount = 0;
  let failureCount = 0;

  for (const file of testFiles) {
    try {
      const testPath = path.join(testsDir, file);
      const testModule = require(testPath);
      if (typeof testModule.run === 'function') {
        await testModule.run(); // supports sync and async suites
        successCount++;
      }
    } catch (err) {
      console.error(`\u2717 Test suite "${file}" failed:`, err && err.message ? err.message : err);
      failureCount++;
    }
  }

  console.log("\n====================================================");
  console.log(`  Tests Execution Summary:`);
  console.log(`  - Total Suites Run:  ${successCount + failureCount}`);
  console.log(`  - Passed Suites:     ${successCount}`);
  console.log(`  - Failed Suites:     ${failureCount}`);
  console.log("====================================================");
  if (failureCount === 0) {
    console.log("\u2705 ALL TEST SUITES PASSED.");
    process.exit(0);
  } else {
    console.log("\u274c SOME TEST SUITES FAILED.");
    process.exit(1);
  }
})();
