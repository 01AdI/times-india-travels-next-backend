const validator=require("validator");

/**
 * Returns the label of the first missing/blank field, or null if all are present.
 * @param {Array<[label: string, value: any]>} fields
 */
function findMissingRequiredField(fields) {
  for (const [label, value] of fields) {
    if (value === undefined || value === null || String(value).trim() === "") {
      return label;
    }
  }
  return null;
}

function validation (data){
    const manditory=["name","email","password"];

    const isallowed=manditory.every((key)=>Object.keys(data).includes(key));

    if(!isallowed)
        throw new Error("field Missing");

    if(!validator.isEmail(data.email))
        throw new Error("email id is not valid");

    if(!(data.password.length>=3 && data.password.length<=30))
        throw new Error("password should be more than 3 words");

    if(!(data.name.length>=3 && data.name.length<=20))
        throw new Error("name should me more than 3 words");

}

module.exports=validation;
module.exports.findMissingRequiredField = findMissingRequiredField;