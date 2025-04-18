const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  MULTI_STATUS: 207,
  MSGV_NOT_FOUND: 440,   
  MSGV_DUPLICATE: 441,   
  MSGV_INVALID: 442,     

  IMPORT_SUCCESS: 210,   
  IMPORT_FAILED: 511,    
  IMPORT_PARTIALLY_FAILED: 443,  
  IMPORT_DUPLICATE_FOUND: 444,   
  IMPORT_INVALID_DATA: 445,

  UNPROCESSABLE_ENTITY: 422,
};

export default HTTP_STATUS;
