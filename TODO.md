# TODO / Roadmap

## Websockets

* remove the lambda that does a tablescan and updates the s3 pipeline-state.json file, in favour of an API Gateway that can hook up websockets.  Pipeline events should be handled as they begin to be now, but without doing a `aws codepipeline get-pipeline-state`.  Instead, the event will update a portion of the dynamodb table.  We could trigger a websocket with just the piece that changed, only for clients that are listening.



