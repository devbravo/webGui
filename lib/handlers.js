/*
 * Request handlers
 */

// Dependencies
const config = require('./config');
const _data = require('./data');
const helpers = require('./helpers');

// Define all the handlers
const handlers = {};

/*
 * HTML Handlers
 */

// Index handler
handlers.index = (data, callback) => {
  // Reject any request that isn't a GET
  if (data.method == 'get') {
    // Read in a template as a string
    helpers.getTemplate('index', function (err, str) {
      if (!err && str) {
        callback(200, str, 'html');
      } else {
        callback(500, undefined, 'html');
      }
    });
  } else {
    callback(405, undefined, 'html');
  }
};

// Ping
handlers.ping = (data, callback) => {
  callback(200);
};

// Not-Found
handlers.notFound = (data, callback) => {
  callback(404);
};

/*
 * JSON API Handlers
 */

// Users

handlers.users = (data, callback) => {
  const acceptableMethods = ['post', 'get', 'put', 'delete'];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._users[data.method](data, callback);
  } else {
    callback(405);
  }
};

// Container for all the users methods
handlers._users = {};

// Users - post
// Required data: firstName, lastName, phone, password, tosAgreement
// Optional data: none
handlers._users.post = async (data, callback) => {
  // Check that all required fields are filled out
  const firstName =
    typeof data.payload.firstName == 'string' && data.payload.firstName.trim().length > 0
      ? data.payload.firstName.trim()
      : false;

  const lastName =
    typeof data.payload.lastName == 'string' && data.payload.lastName.trim().length > 0
      ? data.payload.lastName.trim()
      : false;

  const phone =
    typeof data.payload.phone == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;

  const password =
    typeof data.payload.password == 'string' && data.payload.password.trim().length > 0
      ? data.payload.password.trim()
      : false;

  const tosAgreement =
    typeof data.payload.tosAgreement == 'boolean' && data.payload.tosAgreement == true ? true : false;

  if (firstName && lastName && phone && password && tosAgreement) {
    // Make sure the user doesnt already exist
    const tokenData = await _data.read('users', phone);

    if (typeof tokenData == 'undefined') {
      //Hash the password
      const hashedPassword = helpers.hash(password);
      // Create the user object
      if (hashedPassword) {
        const userObject = {
          firstName: firstName,
          lastName: lastName,
          phone: phone,
          hashedPassword: hashedPassword,
          tosAgreement: true,
        };

        // Store the user
        const createData = await _data.create('users', phone, userObject);
        if (typeof createData == 'undefined') {
          callback(200);
        } else {
          callback(500, { Error: 'Could not create the new user' });
        }
      } else {
        callback(500, {
          Error: "Could not hash the user's password.",
        });
      }
    } else {
      callback(400, {
        Error: 'A user with that phone number already exists',
      });
    }
  } else {
    callback(400, { Error: 'Missing required fields' });
  }
};

// Users - get
// Required data: phone
// Optional data: none
handlers._users.get = async (data, callback) => {
  // Check that the user's phone number is valid
  const phone =
    typeof data.queryStringObject.get('phone') === 'string' && data.queryStringObject.get('phone').trim().length == 10
      ? data.queryStringObject.get('phone').trim()
      : false;

  if (phone) {
    // Get the token from the headers
    const token = typeof data.headers.token === 'string' ? data.headers.token : false;
    // Verify that the given token is valid for the phone number
    const tokenIsValid = await handlers._tokens.verifyToken(token, phone);

    if (tokenIsValid) {
      // Lookup the user
      const readData = await _data.read('users', phone);
      if (readData) {
        // Remove the hashed password from the user object before returning it to the requester
        delete readData.hashedPassword;
        callback(200, readData);
      } else {
        callback(404);
      }
    } else {
      callback(403, {
        Error: 'Missing required token in header, or token is invalid',
      });
    }
  } else {
    callback(400, { Error: 'Missing required field' });
  }
};

// Users - put
// Required data: phone
// Optional data: firstName, lastName, password (at least one must be specified)
handlers._users.put = async (data, callback) => {
  // Check that the user's phone number is valid
  const phone =
    typeof data.payload.phone === 'string' && data.payload.phone.trim().length == 10
      ? data.payload.phone.trim()
      : false;

  // Check for the optional fields
  const firstName =
    typeof data.payload.firstName == 'string' && data.payload.firstName.trim().length > 0
      ? data.payload.firstName.trim()
      : false;

  const lastName =
    typeof data.payload.lastName == 'string' && data.payload.lastName.trim().length > 0
      ? data.payload.lastName.trim()
      : false;

  const password =
    typeof data.payload.password == 'string' && data.payload.password.trim().length > 0
      ? data.payload.password.trim()
      : false;

  // Error if the phone is invalid
  if (phone) {
    // Error if nothing is sent to update
    if (firstName || lastName || password) {
      const token = typeof data.headers.token === 'string' ? data.headers.token : false;

      // Verify that the given token is valid for the phone number
      const tokenIsValid = await handlers._tokens.verifyToken(token, phone);
      if (tokenIsValid) {
        // Lookup the user
        const readData = await _data.read('users', phone);
        if (readData) {
          // Update the fields necessary
          if (firstName) {
            readData.firstName = firstName;
          }
          if (lastName) {
            readData.lastName = lastName;
          }
          if (password) {
            readData.hashedPassword = helpers.hash(password);
          }
          // Store the new updates
          const updateData = await _data.update('users', phone, readData);
          if (!updateData) {
            callback(200);
          } else {
            callback(500, { Error: 'Could not update the user' });
          }
        } else {
          callback(400, { Error: 'The specified user does not exist' });
        }
      } else {
        callback(403, {
          Error: 'Missing required token in header, or token is invalid',
        });
      }
    } else {
      callback(400, { Error: 'Missing fields to update' });
    }
  } else {
    callback(400, { Error: 'Missing required field' });
  }
};

// Users - delete
// Required field : phone
handlers._users.delete = async (data, callback) => {
  // Check that the phone number is valid
  const phone =
    typeof data.queryStringObject.get('phone') === 'string' && data.queryStringObject.get('phone').trim().length == 10
      ? data.queryStringObject.get('phone').trim()
      : false;

  if (phone) {
    const token = typeof data.headers.token === 'string' ? data.headers.token : false;

    // Verify that the given token is valid for the phone number
    const tokenIsValid = await handlers._tokens.verifyToken(token, phone);
    if (tokenIsValid) {
      // Lookup the user
      const userData = await _data.read('users', phone);

      if (userData) {
        const deleteData = await _data.delete('users', phone);
        if (typeof deleteData == 'undefined') {
          // Delete each of the checks associated with the user
          const userChecks =
            typeof userData.checks == 'object' && userData.checks instanceof Array ? userData.checks : [];

          const checksToDelete = userChecks.length;
          if (checksToDelete > 0) {
            let checksDeleted = 0;
            const deletionErrors = false;
            // Loop through the checks
            userChecks.forEach(checkId => {
              // Delete the check
              const deleteData = _data.delete('checks', checkId);
              if (typeof deleteData == 'undefined') {
                deletionErrors = true;
              }
              checksDeleted++;
              if (checksDeleted == checksToDelete) {
                if (!deletionErrors) {
                  callback(200);
                } else {
                  callback(500, {
                    Errors:
                      "Errors encountered while attempting to delete all of the user's checks. All checks may not have bbeen deleted from the system succesfully.",
                  });
                }
              }
            });
          } else {
            callback(200);
          }
        } else {
          callback(500, { Error: 'Could not delete the specified user' });
        }
      } else {
        callback(400, { Error: 'Could find the specified user' });
      }
    } else {
      callback(403, {
        Error: 'Missing required token in header, or token is invalid',
      });
    }
  } else {
    callback(400, { Error: 'Missing required field' });
  }
};

/*============================================================== */
// Tokens

handlers.tokens = (data, callback) => {
  const acceptableMethods = ['post', 'get', 'put', 'delete'];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._tokens[data.method](data, callback);
  } else {
    callback(405);
  }
};

// Container for all the tokens methods
handlers._tokens = {};

// Tokens - post
// Required data: phone, password
// Optional data: none
handlers._tokens.post = async (data, callback) => {
  const phone =
    typeof data.payload.phone == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;

  const password =
    typeof data.payload.password == 'string' && data.payload.password.trim().length > 0
      ? data.payload.password.trim()
      : false;

  if (phone && password) {
    // Lookup the user who matches that phone number

    const readData = await _data.read('users', phone);
    if (readData) {
      // Hash the sent password, and compare it to the password stored in the user object
      const hashedPassword = helpers.hash(password);
      if (hashedPassword == readData.hashedPassword) {
        // If valid, create a new token with a random name. Set expiration data 1 hour in the future
        const tokenId = helpers.createRandomString(20);
        const expires = Date.now() + 1000 * 60 * 60;
        const tokenObject = {
          phone: phone,
          id: tokenId,
          expires: expires,
        };
        // Store the token
        const createData = await _data.create('tokens', tokenId, tokenObject);
        if (typeof createData == 'undefined') {
          callback(200, tokenObject);
        } else {
          callback(500, { Error: 'Could not create the new token' });
        }
      } else {
        callback(400, {
          Error: "Password did not match the specified user's stored password",
        });
      }
    } else {
      callback(400, { Error: 'Could not find the specified user' });
    }
  } else {
    callback(400, { Error: 'Missing required field(s)' });
  }
};

// Tokens - get
// Required data : id
// Optional data: none
handlers._tokens.get = async (data, callback) => {
  // Check that the user's id is valid
  const id =
    typeof data.queryStringObject.get('id') === 'string' && data.queryStringObject.get('id').trim().length == 20
      ? data.queryStringObject.get('id').trim()
      : false;

  if (id) {
    // Lookup the token
    const tokenData = await _data.read('tokens', id);
    if (tokenData) {
      callback(200, tokenData);
    } else {
      callback(404);
    }
  } else {
    callback(400, { Error: 'Missing required field' });
  }
};

// Tokens - put
// Required data : id, extend
// Optional data : none
handlers._tokens.put = async (data, callback) => {
  const id = typeof data.payload.id == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;

  const extend = typeof data.payload.extend == 'boolean' && data.payload.extend == true ? true : false;

  if (id && extend) {
    // Lookup token
    const tokenData = await _data.read('tokens', id);
    if (tokenData) {
      // check to make sure the token isn't already expired
      if (tokenData.expires > Date.now()) {
        // Set the expiration an hour from now
        tokenData.expires = Date.now() + 1000 * 60 * 60;

        // Store the new updates
        const updatedTokenExpDate = await _data.update('tokens', id, tokenData);

        if (typeof updatedTokenExpDate == 'undefined') {
          callback(200);
        } else {
          callback(500, {
            Error: 'Could not update the tokens expiration',
          });
        }
      } else {
        callback(400, {
          Error: 'The token has already expired and cannot be extended',
        });
      }
    } else {
      callback(400, { Error: 'Specified token does not exist' });
    }
  } else {
    callback(400, {
      Error: 'Missing required field(s) or field(s) are invalid',
    });
  }
};

// Tokens - delete
// Required data: id
// Optional data: none
handlers._tokens.delete = async (data, callback) => {
  const id =
    typeof data.queryStringObject.get('id') === 'string' && data.queryStringObject.get('id').trim().length == 20
      ? data.queryStringObject.get('id').trim()
      : false;

  if (id) {
    // Lookup the user
    const tokenData = await _data.read('tokens', id);
    if (tokenData) {
      const deleteData = await _data.delete('tokens', id);
      if (!deleteData) {
        callback(200);
      } else {
        callback(500, { Error: 'Could not delete the specified token' });
      }
    } else {
      callback(400, { Error: "Couldn't find the specified token" });
    }
  } else {
    callback(400, { Error: 'Missing required field' });
  }
};

// Verify if a given token id is currently valid for a given user
handlers._tokens.verifyToken = async (id, phone) => {
  // Lookup the token
  const tokenData = await _data.read('tokens', id);

  if (tokenData) {
    // Check that the token is for the given user and has not expired
    if (tokenData.phone === phone && tokenData.expires > Date.now()) {
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
};

/* ============================= */
// Checks

handlers.checks = (data, callback) => {
  const acceptableMethods = ['post', 'get', 'put', 'delete'];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._checks[data.method](data, callback);
  } else {
    callback(405);
  }
};

// Container for all the checks methods
handlers._checks = {};

// Checks - post
// Required data; protocol, url, methods, successCodes, timeoutSeconds
// Optional data: none
handlers._checks.post = async (data, callback) => {
  const protocol =
    typeof data.payload.protocol == 'string' && ['https', 'http'].indexOf(data.payload.protocol) > -1
      ? data.payload.protocol
      : false;

  const url =
    typeof data.payload.url == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;

  const method =
    typeof data.payload.method == 'string' && ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1
      ? data.payload.method
      : false;

  const successCodes =
    typeof data.payload.successCodes == 'object' &&
    data.payload.successCodes instanceof Array &&
    data.payload.successCodes.length > 0
      ? data.payload.successCodes
      : false;

  const timeoutSeconds =
    typeof data.payload.timeoutSeconds == 'number' &&
    data.payload.timeoutSeconds % 1 === 0 &&
    data.payload.timeoutSeconds >= 1 &&
    data.payload.timeoutSeconds <= 5
      ? data.payload.timeoutSeconds
      : false;

  if (protocol && url && method && successCodes && timeoutSeconds) {
    // Get the token from the headers
    const token = typeof data.headers.token == 'string' ? data.headers.token : false;

    // Lookup the user by reading the token
    const tokenData = await _data.read('tokens', token);
    if (tokenData) {
      const userPhone = tokenData.phone;

      // Lookup the user data
      const userData = await _data.read('users', userPhone);
      if (userData) {
        const userChecks =
          typeof userData.checks == 'object' && userData.checks instanceof Array ? userData.checks : [];

        // Verify that the user has less than the number of max-checks-per-user
        if (userChecks.length < config.maxChecks) {
          // Create a random id for the check
          const checkId = helpers.createRandomString(20);

          // Create the check object, and include the user's phone
          const checkObject = {
            id: checkId,
            userPhone: userPhone,
            protocol: protocol,
            url: url,
            method: method,
            successCodes: successCodes,
            timeoutSeconds: timeoutSeconds,
          };

          // Save the object
          const createData = await _data.create('checks', checkId, checkObject);
          if (typeof createData == 'undefined') {
            // Add the check id to the user's object
            userData.checks = userChecks;
            userData.checks.push(checkId);

            // Save the new user data
            const saveNewUser = await _data.update('users', userPhone, userData);
            if (typeof saveNewUser == 'undefined') {
              // Return the data about the new check
              callback(200, checkObject);
            } else {
              callback(500, {
                Error: 'Could not update the user with the new check',
              });
            }
          } else {
            callback(500, { Error: 'Could not create the new check' });
          }
        } else {
          callback(400, {
            Error: 'The user already has the maximum number of checks',
          });
        }
      } else {
        callback(403);
      }
    } else {
      callback(403);
    }
  } else {
    callback(400, { Error: 'Missing required inputs, or inputs are invalid' });
  }
};

// Checks - get
// Required data : id
// Optional data : none
handlers._checks.get = async (data, callback) => {
  // Check that the user's id is valid
  const id =
    typeof data.queryStringObject.get('id') === 'string' && data.queryStringObject.get('id').trim().length == 20
      ? data.queryStringObject.get('id').trim()
      : false;

  if (id) {
    // Lookup the check
    const checkData = await _data.read('checks', id);
    if (checkData) {
      // Get the token from the headers
      const token = typeof data.headers.token === 'string' ? data.headers.token : false;
      // Verify that the given token is valid and belongs to the user who created the check
      const tokenIsValid = await handlers._tokens.verifyToken(token, checkData.userPhone);
      if (tokenIsValid) {
        // Return the check data
        callback(200, checkData);
      } else {
        callback(403, {
          Error: 'Missing required token in header, or token is invalid',
        });
      }
    } else {
      callback(404);
    }
  } else {
    callback(400, { Error: 'Missing required field' });
  }
};

// Checks - put
// Required data - id
// Optional data : protocol, url, method, successCode, timeoutSeconds (one must be send)
handlers._checks.put = async (data, callback) => {
  // Check that the required fields
  const id =
    typeof data.payload.id === 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;

  const protocol =
    typeof data.payload.protocol == 'string' && ['https', 'http'].indexOf(data.payload.protocol) > -1
      ? data.payload.protocol
      : false;

  const url =
    typeof data.payload.url == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;

  const method =
    typeof data.payload.method == 'string' && ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1
      ? data.payload.method
      : false;

  const successCodes =
    typeof data.payload.successCodes == 'object' &&
    data.payload.successCodes instanceof Array &&
    data.payload.successCodes.length > 0
      ? data.payload.successCodes
      : false;

  const timeoutSeconds =
    typeof data.payload.timeoutSeconds == 'number' &&
    data.payload.timeoutSeconds % 1 === 0 &&
    data.payload.timeoutSeconds >= 1 &&
    data.payload.timeoutSeconds <= 5
      ? data.payload.timeoutSeconds
      : false;

  // Check to make sure id is valid
  if (id) {
    // Check to make sure one or more optional fields has been sent
    if (protocol || url || method || successCodes || timeoutSeconds) {
      // Lookup the check
      const checkData = await _data.read('checks', id);
      if (checkData) {
        // Get the token from the headers
        const token = typeof data.headers.token === 'string' ? data.headers.token : false;
        // Verify that the given token is valid and belongs to the user who created the check
        const tokenIsValid = await handlers._tokens.verifyToken(token, checkData.userPhone);
        if (tokenIsValid) {
          // Update the check where necessary
          if (protocol) {
            checkData.protocol = protocol;
          }
          if (url) {
            checkData.url = url;
          }
          if (method) {
            checkData.method = method;
          }
          if (successCodes) {
            checkData.successCodes = successCodes;
          }
          if (timeoutSeconds) {
            checkData.timeoutSeconds = timeoutSeconds;
          }
          const updateCheckData = await _data.update('checks', id, checkData);
          if (typeof updateCheckData == 'undefined') {
            callback(200);
          } else {
            callback(500, { Error: 'Could not update the check' });
          }
        } else {
          callback(403);
        }
      } else {
        callback(400, { Error: 'Check ID did not exist' });
      }
    } else {
      callback(400, { Error: 'Missing fields to update' });
    }
  } else {
    callback(400, { Error: 'Missing required field' });
  }
};

// Checks - delete
// Required data: id
// Optional data: none
handlers._checks.delete = async (data, callback) => {
  // Check that the id is valid
  const id =
    typeof data.queryStringObject.get('id') === 'string' && data.queryStringObject.get('id').trim().length == 20
      ? data.queryStringObject.get('id').trim()
      : false;

  if (id) {
    // Lookup the check
    const checkData = await _data.read('checks', id);
    if (checkData) {
      // Get the token that sent the request
      const token = typeof data.headers.token == 'string' ? data.headers.token : false;
      // Verify that the given token is valid and belongs to the user who created the check
      const tokenIsValid = await handlers._tokens.verifyToken(token, checkData.userPhone);
      if (tokenIsValid) {
        // Delete the check data
        const deleteData = await _data.delete('checks', id);
        if (typeof deleteData == 'undefined') {
          // Lookup the user's object to get all their checks
          const userData = await _data.read('users', checkData.userPhone);
          if (userData) {
            const userChecks =
              typeof userData.checks == 'object' && userData.checks instanceof Array ? userData.checks : [];

            // Remove the deleted check from their list of checks
            const checkPosition = userChecks.indexOf(id);
            if (checkPosition > -1) {
              userChecks.splice(checkPosition, 1);
              // Re-save the user's data
              userData.checks = userChecks;
              const updateUserData = await _data.update('users', checkData.userPhone, userData);
              if (typeof updateUserData == 'undefined') {
                callback(200);
              } else {
                callback(500, {
                  Error: 'Could not update the user.',
                });
              }
            } else {
              callback(500, {
                Error: "Could not find the check on the user's object, so could not remove it.",
              });
            }
          } else {
            callback(500, {
              Error:
                'Could not find the user who created the check, so could not remove the check from the list of checks on the user object.',
            });
          }
        } else {
          callback(500, { Error: 'Could not delete the check data.' });
        }
      } else {
        callback(403);
      }
    } else {
      callback(400, { Error: 'The check ID specified could not be found' });
    }
  } else {
    callback(400, { Error: 'Missing valid id' });
  }
};

// Export the module
module.exports = handlers;
