const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(__dirname, '..');

const buildCatalogXml = () => {
    return `<?xml version="1.0" encoding="UTF-8"?>\n`
        + '<catalog xmlns="http://www.demandware.com/xml/impex/catalog/2006-10-31" catalog-id="cli-test">\n'
        + '  <product product-id="TEST-PRODUCT">\n'
        + '    <online-flag>true</online-flag>\n'
        + '  </product>\n'
        + '</catalog>\n';
};

const fileExists = async filePath => {
    try {
        await fs.access(filePath);
        return true;
    } catch (error) {
        return false;
    }
};

test('CLI accepts absolute input and output paths', async t => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-cli-'));
    t.after(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    const inputFilename = path.join(tempDir, 'absolute-input.xml');
    const outputFilename = path.join(tempDir, 'absolute-output.xml');

    await fs.writeFile(inputFilename, buildCatalogXml(), 'utf8');

    await execFileAsync(process.execPath, [
        'reducer.js',
        '-i',
        inputFilename,
        '-o',
        outputFilename
    ], {
        cwd: repoRoot,
        timeout: 15000
    });

    assert.equal(await fileExists(outputFilename), true);
    assert.equal(await fileExists(path.join(tempDir, 'absolute-output-inventory.xml')), true);
    assert.equal(await fileExists(path.join(tempDir, 'absolute-output-pricebook.xml')), true);
});

test('CLI accepts an explicit config file path outside config/', async t => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-config-file-'));
    t.after(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    const inputFilename = path.join(tempDir, 'input.xml');
    const outputFilename = path.join(tempDir, 'output.xml');
    const configFilename = path.join(tempDir, 'custom-config.json');

    await fs.writeFile(inputFilename, buildCatalogXml(), 'utf8');
    await fs.writeFile(configFilename, JSON.stringify({
        total: 1,
        master: 0,
        productIds: [],
        attributes: {
            custom: []
        },
        pricebookRandomSeed: 1337,
        pricebookSourceFiles: []
    }, null, 2), 'utf8');

    await execFileAsync(process.execPath, [
        'reducer.js',
        '-c',
        configFilename,
        '-i',
        inputFilename,
        '-o',
        outputFilename
    ], {
        cwd: repoRoot,
        timeout: 15000
    });

    assert.equal(await fileExists(outputFilename), true);
    assert.equal(await fileExists(path.join(tempDir, 'output-inventory.xml')), true);
    assert.equal(await fileExists(path.join(tempDir, 'output-pricebook.xml')), true);
});

test('CLI rejects the removed project flag with migration guidance', async () => {
    await assert.rejects(
        execFileAsync(process.execPath, [
            'reducer.js',
            '-p',
            'test',
            '-i',
            'files/source/puma-catalog.xml',
            '-o',
            'files/filtered/removed-project-flag.xml'
        ], {
            cwd: repoRoot,
            timeout: 15000
        }),
        error => {
            return /--project\/-p option has been removed/.test(`${error.stderr}\n${error.stdout}`);
        }
    );
});
