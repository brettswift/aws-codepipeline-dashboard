export function assert_required_param(param_name: string, param_value: string, suggestion?: string) {
  suggestion = suggestion || '<value>';
  if (!param_value) {
    console.log("-------- PARAMETER REQUIRED ------");
    console.log(`${param_name} is a required parameter.  \n` +
      `You can add it like this:  cdk deploy -c ${param_name}=${suggestion}`);
    console.log("");
    throw new Error("required parameter");
  }
}
