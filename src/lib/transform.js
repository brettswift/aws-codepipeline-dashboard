var DataTransform = require("node-json-transform").DataTransform

class CodePipelineTransform{

    constructor(){

    }

    tranform(codepipeline){

        var wrapped = {
            shimlist: [
                codepipeline
            ]
        }
        var map = {
            list: "shimlist",
            item: {
                name: "pipelineName"
            }
        }

        var dataTransform = DataTransform(wrapped, map);
        var wrapped_results = dataTransform.transform();
        var result = wrapped_results[0]
        console.log(result)
        return result
    }
}

module.exports = CodePipelineTransform