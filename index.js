const functions = require('firebase-functions');
const Firestore = require('@google-cloud/firestore');
const twilio = require('twilio');
const USERS_COLLECTION = 'users';
const firestore = new Firestore({
  projectId: 'REPLACE ME',
  timestampsInSnapshots: false,
});

const express = require('express');

const app = express();

app.use(express.json());

var accountSid = 'REPLACE ME'; // Your Account SID from www.twilio.com/console
var authToken = 'REPLACE ME'; 

app.post('', (req, res) => {
    console.log('req', req);
	var client = new twilio(accountSid, authToken);
    const responseBody = req.body;
    console.log(responseBody);
    console.log('intent is', responseBody.queryResult.intent.displayName);

    const getFullMessage = (message) => {
        return '<speak>' + message + '</speak>';
    };

    switch(responseBody.queryResult.intent.displayName) {
        case 'Transaction':

                return new Promise((resolve, reject) => {
                    console.log('Transaction: Amount to Transfer', responseBody.queryResult.parameters['amount']);
        
                    const amountToTransfer = responseBody.queryResult.parameters['amount'];
                    let sourcePhoneNumber = responseBody.queryResult.parameters['phone-number'];
        
                    firestore.collection(USERS_COLLECTION).where('phone-number', '==' , sourcePhoneNumber).get().then(snapshot => {
                        if (snapshot.empty) {
                            console.log('No matching documents.');
                            const srcNumNotFoundMessage = 'Sorry the phone number <say-as interpret-as="telephone">' + sourcePhoneNumber + '</say-as> is not registered with us';
                            res.json({
                                "fulfillmentMessages": [{ 
                                "platform": "GOOGLE_TELEPHONY", 
                                "telephonySynthesizeSpeech": { "ssml": getFullMessage(srcNumNotFoundMessage) }
                                }]
                            });
                            return resolve();
                        }
        
                        snapshot.forEach(doc => {
                            console.log(doc.id, '=>', doc.data());
                            const user = doc.data();
                           

                            if(!user['is-authenticated']) {
                                 const codelength = 6;
                                 const random_otp = Math.floor(Math.random() * (Math.pow(10, (codelength - 1)) * 9)) + Math.pow(10, (codelength - 1));
                                 firestore.collection(USERS_COLLECTION).doc(doc.id).update({
                                            'otp': random_otp
                                  }).then(result => {
                                     client.messages.create({
                                  body: 'Your otp is ' + random_otp,
                                  to: '+91' + user['phone-number'] ,  // Text this number
                                  from: '+18189243776' // From a valid Twilio number
                              })
                              .then((message) => {
                                      const otpMessage = 'You need to be authenticated to perform this operation <break time="0.5s"/> We have sent an OTP to the phone number <say-as interpret-as="telephone">' + sourcePhoneNumber + '</say-as> please mention it';

                                     res.json({
                                    "fulfillmentMessages": [{ 
                                    "platform": "GOOGLE_TELEPHONY", 
                                    "telephonySynthesizeSpeech": { "ssml": getFullMessage(otpMessage) }
                                    }]
                                });
                                return resolve();
                               })
                              .catch(err => console.log(err));
                                
                               });
                                 
                            }
                          else{
        
                            const currAccountBalance = user['account-balance'];
                            if(parseInt(currAccountBalance) - parseInt(amountToTransfer.amount) < 0) {
                                res.json({
                                    "fulfillmentMessages": [{ 
                                    "platform": "GOOGLE_TELEPHONY", 
                                    "telephonySynthesizeSpeech": { "ssml": getFullMessage("Sorry cannot transfer funds due to insufficient balance") }
                                    }]
                                });
                                return resolve();
                            }
        
                            const destPhoneNumber = responseBody.queryResult.parameters['to-number'];
                            firestore.collection(USERS_COLLECTION).where('phone-number', '==' , destPhoneNumber).get().then(snapshot => {
                                if (snapshot.empty) {
                                    console.log('No matching documents for to number');
                                    const destNumNotFoundMessage = 'Sorry the destination phone number <say-as interpret-as="telephone">' + destPhoneNumber + '</say-as> is not registered with us';
                                     res.json({
                                         "fulfillmentMessages": [{ 
                                         "platform": "GOOGLE_TELEPHONY", 
                                         "telephonySynthesizeSpeech": { "ssml": getFullMessage(destNumNotFoundMessage) }
                                         }]
                                     });
                                     return resolve();
                                }
        
                                snapshot.forEach(destUserDoc => {
                                    console.log('Destination Number', destUserDoc.id, '=>', destUserDoc.data());
        
                                    const destinationUser = destUserDoc.data();
                                    const currDestAccountBalance = destinationUser['account-balance'];
        
                                    firestore.collection(USERS_COLLECTION).doc(destUserDoc.id).update({
                                        'account-balance': parseInt(currDestAccountBalance) + parseInt(amountToTransfer.amount)
                                    }).then(destRes => {
                                        console.log('updated dest user after setting auth status', destRes);
        
                                        firestore.collection(USERS_COLLECTION).doc(doc.id).update({
                                            'account-balance': parseInt(currAccountBalance) - parseInt(amountToTransfer.amount)
                                        }).then(srcRes => {
                                            console.log('updated src user after setting auth status', srcRes);
                                            const updatedBalance = parseInt(currAccountBalance) - parseInt(amountToTransfer.amount)
                                            const transferDoneMessage = 'Amount has been transferred from your phone number <say-as interpret-as="telephone">' + sourcePhoneNumber 
                                            + '</say-as> to the phone number <say-as interpret-as="telephone">' + destPhoneNumber + '</say-as> <break time="0.5s"/> Your current balance is ' 
                                            + updatedBalance + user['currency'];
        
                                            res.json({
                                                "fulfillmentMessages": [{ 
                                                "platform": "GOOGLE_TELEPHONY", 
                                                "telephonySynthesizeSpeech": { "ssml": getFullMessage(transferDoneMessage) }
                                                }]
                                            });
                                        }).catch(err => {
                                            console.log('error when set authentication status', err);
                                        });
                                    }).catch(err => {
                                        console.log('error when set authentication status', err);
                                    });
                                });
                            }).catch(err => {
                                console.log('error occured while increasing amount to to-number', err);
                                return resolve();
                            });
                          }
                        });
                        
                        return resolve();
                    }).catch(err => {
                        console.log(err);
                        //agent.add('Sorry something went wrong. Please try again');
                        return resolve();
                    });
                
                });    
        
        //break;

        case 'Account Balance': //console.log('intent is Account Balance')

        return new Promise((resolve, reject) => {
            sourcePhoneNumber = responseBody.queryResult.parameters['phone-number'];

            firestore.collection(USERS_COLLECTION).where('phone-number', '==' , sourcePhoneNumber).get().then(snapshot => {
                if (snapshot.empty) {
                    console.log('No matching documents.');
                    const srcNumNotFoundMessage = 'Sorry the phone number <say-as interpret-as="telephone">' + sourcePhoneNumber + '</say-as> is not registered with us';
                    res.json({
                        "fulfillmentMessages": [{ 
                        "platform": "GOOGLE_TELEPHONY", 
                        "telephonySynthesizeSpeech": { "ssml": getFullMessage(srcNumNotFoundMessage) }
                        }]
                    });
                    return resolve();
                }

                snapshot.forEach(doc => {
                    console.log(doc.id, '=>', doc.data());
                    const user = doc.data();
                    if(!user['is-authenticated']) {
                      const otpMessage = 'You need to be authenticated to perform this operation <break time="0.5s"/> We have sent an OTP to the phone number <say-as interpret-as="telephone">' + sourcePhoneNumber + '</say-as> please mention it';

                        const codelength = 6;
                      const random_otp = Math.floor(Math.random() * (Math.pow(10, (codelength - 1)) * 9)) + Math.pow(10, (codelength - 1));
                      firestore.collection(USERS_COLLECTION).doc(doc.id).update({
                        'otp': random_otp
                      }).then(result => {
                        client.messages.create({
                          body: 'Your otp is ' + random_otp,
                          to: '+91' + user['phone-number'] ,  // Text this number
                          from: '+18189243776' // From a valid Twilio number
                         })
                              .then((message) => {
                                     res.json({
                                    "fulfillmentMessages": [{ 
                                    "platform": "GOOGLE_TELEPHONY", 
                                    "telephonySynthesizeSpeech": { "ssml": getFullMessage(otpMessage) }
                                    }]
                                });
                                return resolve();
                               })
                              .catch(err => console.log(err));
                                
                               });
                    }
					else{
                    const accountBalanceMessage = 'Your Account balance is ' + user['account-balance'] + user['currency'];
                    console.log('Account Balance for already authenciated person', accountBalanceMessage);

                    res.json({
                        "fulfillmentMessages": [{ 
                        "platform": "GOOGLE_TELEPHONY", 
                        "telephonySynthesizeSpeech": { "ssml": getFullMessage(accountBalanceMessage) }
                        }]
                    });
                    }
                });
                
                return resolve();
            }).catch(err => {
                console.log(err);
                return resolve();
            });  
        });
        //break;

        case 'Authentication':

        console.log('authenticateAndExecute: phone number', responseBody.queryResult.outputContexts[0].parameters['phone-number']);
        console.log('authenticateAndExecute: otp', responseBody.queryResult.parameters['otp']);
        console.log('authenticateAndExecute: intent is', responseBody.queryResult.outputContexts[0].parameters['intent']);
    
        sourcePhoneNumber = responseBody.queryResult.outputContexts[0].parameters['phone-number'];
        return new Promise((resolve,reject) => {
            firestore.collection(USERS_COLLECTION).where('phone-number', '==' , sourcePhoneNumber).get().then(snapshot => {
                if (snapshot.empty) {
                    console.log('No matching documents.');
                    const srcNumNotFoundMessage = 'Sorry the phone number <say-as interpret-as="telephone">' + sourcePhoneNumber + '</say-as> is not registered with us';
                    res.json({
                        "fulfillmentMessages": [{ 
                        "platform": "GOOGLE_TELEPHONY", 
                        "telephonySynthesizeSpeech": { "ssml": getFullMessage(srcNumNotFoundMessage) }
                        }]
                    })
                    return resolve();
                }
    
                snapshot.forEach(doc => {
                    console.log(doc.id, '=>', doc.data());
                    const user = doc.data();
                    if(parseInt(user.otp) !== parseInt(responseBody.queryResult.parameters['otp'])) {
                        res.json({
                            "fulfillmentMessages": [{ 
                            "platform": "GOOGLE_TELEPHONY", 
                            "telephonySynthesizeSpeech": { "ssml": "<speak>You have mentioned an invalid OTP</speak>" }
                            }]
                        });
                        return resolve();
                    }
                    
                    firestore.collection(USERS_COLLECTION).doc(doc.id).update({
                        'is-authenticated': true
                    }).then(res => {
                        console.log('updated user after setting auth status', res);
                    }).catch(err => {
                        console.log('error when set authentication status', err);
                    });
                    if(responseBody.queryResult.outputContexts[0].parameters['intent'] === 'Account Balance') {
                        const accountBalanceMessage = 'Your Account balance is ' + user['account-balance'] + user['currency'];
                        console.log('Account Balance', accountBalanceMessage);

                        res.json({
                            "fulfillmentMessages": [{ 
                            "platform": "GOOGLE_TELEPHONY", 
                            "telephonySynthesizeSpeech": { "ssml": getFullMessage(accountBalanceMessage) }
                            }]
                        });
                    } else if (responseBody.queryResult.outputContexts[0].parameters['intent'] === 'Transaction') {
                        console.log('Transaction: Amount to Transfer', responseBody.queryResult.outputContexts[0].parameters['amount']);
        
                    let amountToTransfer = responseBody.queryResult.outputContexts[0].parameters['amount'];
                    let sourcePhoneNumber = responseBody.queryResult.outputContexts[0].parameters['phone-number'];
                    
        
                    firestore.collection(USERS_COLLECTION).where('phone-number', '==' , sourcePhoneNumber).get().then(snapshot => {
                        if (snapshot.empty) {
                            console.log('No matching documents.');
                            const srcNumNotFoundMessage = 'Sorry the phone number <say-as interpret-as="telephone">' + sourcePhoneNumber + '</say-as> is not registered with us';
                            res.json({
                                "fulfillmentMessages": [{ 
                                "platform": "GOOGLE_TELEPHONY", 
                                "telephonySynthesizeSpeech": { "ssml": getFullMessage(srcNumNotFoundMessage) }
                                }]
                            });
                            return resolve();
                        }
        
                        snapshot.forEach(doc => {
                            console.log(doc.id, '=>', doc.data());
                            const user = doc.data();
        
                            const currAccountBalance = user['account-balance'];
                            if(parseInt(currAccountBalance) - parseInt(amountToTransfer.amount) < 0) {
                                res.json({
                                    "fulfillmentMessages": [{ 
                                    "platform": "GOOGLE_TELEPHONY", 
                                    "telephonySynthesizeSpeech": { "ssml": getFullMessage("Sorry cannot transfer funds due to insufficient balance") }
                                    }]
                                });
                                return resolve();
                            }
        
                            const destPhoneNumber = responseBody.queryResult.outputContexts[0].parameters['to-number'];
                            firestore.collection(USERS_COLLECTION).where('phone-number', '==' , destPhoneNumber).get().then(snapshot => {
                                if (snapshot.empty) {
                                    console.log('No matching documents for to number');
                                    const destNumNotFoundMessage = 'Sorry the destination phone number <say-as interpret-as="telephone">' + destPhoneNumber + '<say-as interpret-as="telephone"> is not registered with us';
                                     res.json({
                                         "fulfillmentMessages": [{ 
                                         "platform": "GOOGLE_TELEPHONY", 
                                         "telephonySynthesizeSpeech": { "ssml": getFullMessage(destNumNotFoundMessage) }
                                         }]
                                     });
                                     return resolve();
                                }
        
                                snapshot.forEach(destUserDoc => {
                                    console.log('Destination Number', destUserDoc.id, '=>', destUserDoc.data());
                                    
                                    const destinationUser = destUserDoc.data();
                                    const currDestAccountBalance = destinationUser['account-balance'];
        
                                    firestore.collection(USERS_COLLECTION).doc(destUserDoc.id).update({
                                        'account-balance': parseInt(currDestAccountBalance) + parseInt(amountToTransfer.amount)
                                    }).then(destRes => {
                                        console.log('updated dest user after setting auth status', destRes);
        
                                        firestore.collection(USERS_COLLECTION).doc(doc.id).update({
                                            'account-balance': parseInt(currAccountBalance) - parseInt(amountToTransfer.amount)
                                        }).then(srcRes => {
                                            console.log('updated src user after setting auth status', srcRes);
                                            const updatedBalance = parseInt(currAccountBalance) - parseInt(amountToTransfer.amount)
                                            const transferDoneMessage = 'Amount has been transferred from your phone number <say-as interpret-as="telephone">' + sourcePhoneNumber 
                                            + '</say-as> to the phone number <say-as interpret-as="telephone">' + destPhoneNumber + '</say-as> <break time="0.5s"/> Your current balance is ' 
                                            + updatedBalance + user['currency'];
        
                                            res.json({
                                                "fulfillmentMessages": [{ 
                                                "platform": "GOOGLE_TELEPHONY", 
                                                "telephonySynthesizeSpeech": { "ssml": getFullMessage(transferDoneMessage) }
                                                }]
                                            });
                                        }).catch(err => {
                                            console.log('error when set authentication status', err);
                                        });
                                    }).catch(err => {
                                        console.log('error when set authentication status', err);
                                    });
                                });
                            }).catch(err => {
                                console.log('error occured while increasing amount to to-number', err);
                                return resolve();
                            });
                        })
                        
                        return resolve();
                    }).catch(err => {
                        console.log(err);
                        //agent.add('Sorry something went wrong. Please try again');
                        return resolve();
                    });   
                    }
                });
                
                return resolve();
            }).catch(err => {
                console.log(err);
                res.json({
                    "fulfillmentMessages": [{ 
                    "platform": "GOOGLE_TELEPHONY", 
                    "telephonySynthesizeSpeech": { "text": "Sorry something went wrong. Please try again" }
                    }]
                });
                return resolve();
            });  
        });
        //break;

        case 'Exit':
            sourcePhoneNumber = responseBody.queryResult.outputContexts[0].parameters['phone-number'];
            if(sourcePhoneNumber) {
                return new Promise((resolve, reject) => {
                    firestore.collection(USERS_COLLECTION).where('phone-number', '==' , sourcePhoneNumber).get().then(snapshot => {
    
                        snapshot.forEach(doc => {
                            console.log('When Exiting', doc.id, '=>', doc.data());
                            const user = doc.data();
                            
                            firestore.collection(USERS_COLLECTION).doc(doc.id).update({
                                'is-authenticated': false
                            }).then(exitPromiseResponse => {
                                console.log('Exit done');
                
                                res.json({
                                    "fulfillmentMessages": [{ 
                                    "platform": "GOOGLE_TELEPHONY", 
                                    "telephonySynthesizeSpeech": { "text": "Session exited" }
                                    }]
                                });
                            }).catch(err => {
                                console.log('error when setting auth false', err);
                            });
                        });
                        
                        return resolve();
                    }).catch(err => {
                        console.log('error when exiting', err);
                        return resolve();
                    });
                });
            }
        break;

        default:
        break;
    }
});

const api = functions.https.onRequest(app);

module.exports = {
    dialogflowFirebaseFulfillment: api
}