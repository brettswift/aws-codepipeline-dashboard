const expect = require('chai').expect;

const pipeline_sample1 = require('./sample-data/pipeline-transform/pipeline-state.json')
const expected_pipeline_state = require('./sample-data/pipeline-transform/expected_dashboard_data.json')

const CodePipelineTransform = require('../src/lib/transform.js');

const transformer = new CodePipelineTransform()

describe('Transforms', () => {
    
    it('transform codepipeline to expected dashboard format', () => {

        const result = transformer.tranform(pipeline_sample1);

        expect(result.name).to.equal("first_pipelne_id")
        expect(result.version)
        // expect(pipeline_sample1).to.eql(expected_pipeline_state)

    })
})