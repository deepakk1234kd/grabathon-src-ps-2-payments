### Prequisites

- Dialogflow agent account
- Google Firebase account
- Twilio Account

### Installation
+ Checkout the source code from git
+ search for 'REPLACE ME' in index.js file and replace them appropriately
	+ For projectId, replace with DialogFlow projectId
	+ For accountSid and authToken, relpace with twilio API credentials
+ Create an agent in Dialogflow
	+ Go to settings
	+ Got to Import and Export Tab
	+ Click Import as Zip button and import the zip file in src code
+ The necessary cloud functions and dependencies are in index.js file and package.json resectively, copy the entire content and paste it in Inline Editor in Fulfilment tab
+ Then deploy

### Data
+ You can create the data manually in cloud firestore in google firebase with the following content
	+ create collection 'users' with following fields
		+ account-balance - number
		+ currency - string
		+ is-authenticated - boolean
		+ otp - number
		+ phone-number - string
	+ Prepopulate like two records except OTP

### How to Run
+ Account Balance Workflow
	+ Dial to the number in 'Dialogflow Phone Gateway'
	+ Tell 'I want to know my account balance'
	+ Tell the phone number
	+ Tell the otp authenticated
	+ Then the bot will reply back with the right account balance
+ Money Transfer
	+ Dial to the number in ‘Dialogflow Phone Gateway’
	+ Tell 'I want to transfer money'
	+ Tell the amount you want to transfer
	+ Tell the destination number
	+ Tell your number
	+ Tell the otp if not authenticated
	+ Then the bot will transfer the money