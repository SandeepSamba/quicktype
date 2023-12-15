const { quicktype, InputData, JSONSchemaInput, FetchingJSONSchemaStore } = require("quicktype-core");
const fs = require("fs");
const fetch = require("cross-fetch");
const refParser = require("@apidevtools/json-schema-ref-parser");

async function quicktypeJSONSchema(targetLanguage, typeName, jsonSchemaString) {
    const schemaInput = new JSONSchemaInput(new FetchingJSONSchemaStore());
    await schemaInput.addSource({ name: typeName, schema: jsonSchemaString });

    const inputData = new InputData();
    inputData.addInput(schemaInput);

    return await quicktype({
        inputData,
        lang: targetLanguage,
        rendererOptions: {
            "field-tags": "json",
            "package": "metadata"
        },
        allPropertiesOptional: false
    });
}

function AddQuicktypePropertyOrderToJsonSchema(obj) {
    if (Array.isArray(obj)) {
        obj.forEach(item => AddQuicktypePropertyOrderToJsonSchema(item));
    } else if (typeof obj === "object" && obj !== null) {
        for (const key in obj) {
            if (key === "properties") {
                if (typeof obj === "object" && obj !== null) {
                    const quicktypePropertyOrder = [];
                    for (const subkey in obj[key]) {
                        quicktypePropertyOrder.push(subkey);
                    }
                    obj.quicktypePropertyOrder = quicktypePropertyOrder;
                }
            }
            if (typeof obj[key] === "object" && obj[key] !== null) {
                AddQuicktypePropertyOrderToJsonSchema(obj[key]);
            }
        }
    }
}

const rawJSONSchema = "./raw.json";
const resolvedJSONSchema = "./resolved.json";
const quickTypeInputJSONSchema = "./input.json";

async function ResolveJsonSchema() {
    globalThis.fetch = fetch;
    return refParser.bundle(rawJSONSchema);
}

async function main() {
    let resolvedSchema;
    try {
        resolvedSchema = await ResolveJsonSchema();
        fs.writeFileSync(resolvedJSONSchema, JSON.stringify(resolvedSchema, null, 2));
    } catch (err) {
        console.error(err);
    }
    let jsonSchema = JSON.parse(fs.readFileSync(resolvedJSONSchema, "utf8"));
    AddQuicktypePropertyOrderToJsonSchema(jsonSchema);
    fs.writeFileSync(quickTypeInputJSONSchema, JSON.stringify(jsonSchema, null, 2));
    const { lines: goCode } = await quicktypeJSONSchema("go", "Metadata", JSON.stringify(jsonSchema));
    fs.writeFileSync("types.go", goCode.join("\n"));
}

main();
