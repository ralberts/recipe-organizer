const alexaSDK = require('alexa-sdk');
const awsSDK = require('aws-sdk');
const promisify = require('es6-promisify');
const _ = require('lodash');

// const appId = 'arn:aws:lambda:us-east-1:678697930350:function:CoffeePro';
const appId = 'amzn1.ask.skill.33e18e3f-2310-4112-b9f5-9390ade25609';
const recipesTable = 'Recipes';
const docClient = new awsSDK.DynamoDB.DocumentClient();

// convert callback style functions to promises
const dbScan = promisify(docClient.scan, docClient);
const dbGet = promisify(docClient.get, docClient);
const dbPut = promisify(docClient.put, docClient);
const dbDelete = promisify(docClient.delete, docClient);

// firebase connection
const firebase = require('firebase');
const config = {
  apiKey: 'AIzaSyDMNa01ILPSggoTa8CURd_Bt52eDaKN_Fc',
  authDomain: 'coffee-dash-button.firebaseapp.com',
  databaseURL: 'https://coffee-dash-button.firebaseio.com/'
}
firebase.initializeApp(config);
const firebaseDB = firebase.database();

const instructions = `Welcome to Recipe Organizer<break strength="medium" />
                      The following commands are available: add recipe, get recipe,
                      get all recipes, get a random recipe, and delete recipe. What
                      would you like to do?`;

const quotes = [
  'Please drink responsibly.',
  'As Kevin says - Just give me my caffeine and nobody gets hurt!',
  'Coffee can’t cure everything, but it can cure the mornings!',
  'Error running WAKEUP.BAT: COFFEE.INI not found.',
  'Coffee, like life… One sip at a time.',
  'Death before decaf!!!',
  'Bean me up!',
  'COFFEE : Cup OF Finest Enjoyment Ever!',
  'Hello. My name is Laura and I’m a coffeeholic. It’s been 38 seconds since my last sip.',
  'Nothing really can be said after the first sip but a desiringly quiet utter of, “mmmm, coffeeee”.',
  'Coffee, all the goodness of life in a cup.',
  'Coffee is like drinking sunshine!',
  'Latte is French for “You just paid too much for your coffee”.',
  'OCD: Obsessive Coffee Disorder',
  'SHHHH My coffee and I are having a moment.  I’ll deal with you later.',
  'Not to get technical, but according to chemistry, coffee is a solution.',
  'It’s not procrastinating if you’re drinking coffee, it’s procaffinating.',
  'Coffee is the foundation of my food pyramid.'
];

const handlers = {

  /**
   * Triggered when the user says "Alexa, open Recipe Organizer.
   */
  'LaunchRequest'() {
    this.emit(':ask', instructions);
  },



  /**
   * List all coffee stats
   * Slots: GetCoffeeStatsQuickOrLong
   */
  'GetCoffeeStatsIntent'() {
    const { userId } = this.event.session.user;
    const { slots } = this.event.request.intent;
    let output;

    // prompt for slot data if needed
    if (!slots.GetCoffeeStatsQuickOrLong.value) {
      const slotToElicit = 'GetCoffeeStatsQuickOrLong';
      const speechOutput = 'Would you like to hear quick stats or long stats?';
      const repromptSpeech = 'Would you like to hear quick stats or long stats?';
      return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
    }
    console.log("long or quick?: ", slots.GetCoffeeStatsQuickOrLong.value);
    const collection = firebaseDB.ref('presses');
    collection.once('value').then((snap) => {
      const presses = _.map(snap.val(), 'type');
      const totalPots = presses.length;
      let frenchPots = 0;
      let morningPots = 0;
      presses.forEach((value) => {
        if (value === 'French Roast') {
          frenchPots++;
        } else if (value === 'Morning Roast') {
          morningPots++;
        }
      });
      console.log(frenchPots, morningPots);
      const isQuick = slots.GetCoffeeStatsQuickOrLong.value.toLowerCase() === 'quick';
      const isLong = slots.GetCoffeeStatsQuickOrLong.value.toLowerCase() === 'long';

      if (isQuick || isLong) {
        output = `The following ${isQuick ? 'quick' : 'long'} stat briefing are as follows: <break strength="x-strong" />`;
      }
      else {
        output = 'The following statistics are as follows: <break strength="x-strong" />';
      }

      output += 'There have been ' + totalPots + ' pots of coffee brewed this month; ' + frenchPots + ' french roast and ' + morningPots + ' morning roast.';
      if (isLong) {
        output += '<break strength="x-strong"/> On average, most coffee is brewed on a Monday.  There have been ' + totalPots + ' pots of coffee brewed this year.  Most coffee is brewed between the hours of 7am and 8am.';
      }
      console.log('output', output);
      this.emit(':tell', output);
    });
  },


  /**
   * Get last coffee update
   * Slots: CoffeeRoastType
   */
  'GetCoffeeLastBrewedIntent'() {
    const { userId } = this.event.session.user;
    const { slots } = this.event.request.intent;
    let output;
    const one_day = 1000*60*60*24;
    const one_hour = 1000*60*60;
    const one_minute = 1000*60;
    const one_second = 1000;

    const collection = firebaseDB.ref('presses');
    // prompt for slot data if needed
    if (!slots.CoffeeRoastType.value) {
      collection.once('value').then((snap) => {
        const presses = _.map(snap.val());
        const type = _.sortBy(presses, "date").reverse()[0].type;
        const date = new Date(_.sortBy(presses, "date").reverse()[0].date);
        const lastBrewed = "The last pot of coffee was a pot of " + type + " and was brewed at " + date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) + "on " + date.toDateString() + '<break strength="x-strong"/>';
        const slotToElicit = 'CoffeeRoastType';
        const speechOutput = lastBrewed + 'To hear about a specific roast type, please tell me the name?';
        const repromptSpeech = 'To hear about a specific roast type, please tell me the name?';
        return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
      });
    } else if (slots.CoffeeRoastType.value.toLowerCase() === 'decaf') {
      output = 'Decaffeinated coffee is like a hairless cat, it exists, but that doesn’t make it right';
      console.log('output', output);
      this.emit(':tell', output);
    } else {
      collection.once('value').then((snap) => {
        if (slots.CoffeeRoastType.value.toLowerCase() === 'medium') {
          slots.CoffeeRoastType.value = 'morning';
        }
        let presses = _.map(snap.val());
        presses = _.filter(presses, function(item) {
          return item.type.toLowerCase().includes(slots.CoffeeRoastType.value.toLowerCase());
        });
        const queriedType = _.sortBy(presses, "date").reverse()[0].type;

        const difference = Date.parse(new Date().toISOString()) - Date.parse(_.sortBy(presses, "date").reverse()[0].date);
        const days = Math.floor(difference/one_day);
        const hours = Math.floor(difference/one_hour);
        const minutes = Math.floor(difference/one_minute);
        const seconds = Math.floor(difference/one_second);

        output = "It's been ";
        if (days > 0) {
          output += (days + ' day(s), ');
        }
        if (hours > 0) {
          output += (hours - days * 24 + ' hour(s), ');
        }
        if (minutes > 0) {
          output += (minutes - hours * 60 + ' minute(s), ');
        }
        if (seconds > 0){
          output += (seconds - minutes * 60 + ' second(s)');
        }
        output += " since a pot of " + queriedType + " was brewed."

        console.log('output', output);
        this.emit(':tell', output);
      });
    }
  },


  /**
   * Get coffee quote
   */
  'GetCoffeeQuote'() {
    console.log("start");
    const { userId } = this.event.session.user;
    const { slots } = this.event.request.intent;
    let output = "This is a default";
    console.log("outside async");
    const collection = firebaseDB.ref('messages');
    collection.once('value').then((snap) => {
      console.log("inside async");
      var messages = snap.val();
      output = _.sample(_.map(messages, 'text'))
      console.log(output);
      this.emit(':tell', output);
      // firebase.database().goOffline();
    }, (e) => {
      console.log("Get Quote Error: ", e);
    }).catch(err => {
        console.error("Get Quote Catch: ", err);
    });
  },




  // /**
  //  * Adds a recipe to the current user's saved recipes.
  //  * Slots: RecipeName, RecipeLocation, LongOrQuick
  //  */
  // 'AddRecipeIntent'() {
  //   const { userId } = this.event.session.user;
  //   const { slots } = this.event.request.intent;
  //
  //   // prompt for slot values and request a confirmation for each
  //
  //   // RecipeName
  //   if (!slots.RecipeName.value) {
  //     const slotToElicit = 'RecipeName';
  //     const speechOutput = 'What is the name of the recipe?';
  //     const repromptSpeech = 'Please tell me the name of the recipe';
  //     return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
  //   }
  //   else if (slots.RecipeName.confirmationStatus !== 'CONFIRMED') {
  //
  //     if (slots.RecipeName.confirmationStatus !== 'DENIED') {
  //       // slot status: unconfirmed
  //       const slotToConfirm = 'RecipeName';
  //       const speechOutput = `The name of the recipe is ${slots.RecipeName.value}, correct?`;
  //       const repromptSpeech = speechOutput;
  //       return this.emit(':confirmSlot', slotToConfirm, speechOutput, repromptSpeech);
  //     }
  //
  //     // slot status: denied -> reprompt for slot data
  //     const slotToElicit = 'RecipeName';
  //     const speechOutput = 'What is the name of the recipe you would like to add?';
  //     const repromptSpeech = 'Please tell me the name of the recipe';
  //     return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
  //   }
  //
  //   // RecipeLocation
  //   if (!slots.RecipeLocation.value) {
  //     const slotToElicit = 'RecipeLocation';
  //     const speechOutput = 'Where can the recipe be found?';
  //     const repromptSpeech = 'Please give me a location where the recipe can be found.';
  //     return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
  //   }
  //   else if (slots.RecipeLocation.confirmationStatus !== 'CONFIRMED') {
  //
  //     if (slots.RecipeLocation.confirmationStatus !== 'DENIED') {
  //       // slot status: unconfirmed
  //       const slotToConfirm = 'RecipeLocation';
  //       const speechOutput = `The recipe location is ${slots.RecipeLocation.value}, correct?`;
  //       const repromptSpeech = speechOutput;
  //       return this.emit(':confirmSlot', slotToConfirm, speechOutput, repromptSpeech);
  //     }
  //
  //     // slot status: denied -> reprompt for slot data
  //     const slotToElicit = 'RecipeLocation';
  //     const speechOutput = 'Where can the recipe be found?';
  //     const repromptSpeech = 'Please give me a location where the recipe can be found.';
  //     return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
  //   }
  //
  //   // LongOrQuick
  //   if (!slots.LongOrQuick.value) {
  //     const slotToElicit = 'LongOrQuick';
  //     const speechOutput = 'Is this a quick or long recipe to make?';
  //     const repromptSpeech = 'Is this a quick or long recipe to make?';
  //     return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
  //   }
  //   else if (slots.LongOrQuick.confirmationStatus !== 'CONFIRMED') {
  //
  //     if (slots.LongOrQuick.confirmationStatus !== 'DENIED') {
  //       // slot status: unconfirmed
  //       const slotToConfirm = 'LongOrQuick';
  //       const speechOutput = `This is a ${slots.LongOrQuick.value} recipe, correct?`;
  //       const repromptSpeech = speechOutput;
  //       return this.emit(':confirmSlot', slotToConfirm, speechOutput, repromptSpeech);
  //     }
  //
  //     // slot status: denied -> reprompt for slot data
  //     const slotToElicit = 'LongOrQuick';
  //     const speechOutput = 'Is this a quick or long recipe to make?';
  //     const repromptSpeech = 'Is this a quick or long recipe to make?';
  //     return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
  //   }
  //
  //   // all slot values received and confirmed, now add the record to DynamoDB
  //
  //   const name = slots.RecipeName.value;
  //   const location = slots.RecipeLocation.value;
  //   const isQuick = slots.LongOrQuick.value.toLowerCase() === 'quick';
  //   const dynamoParams = {
  //     TableName: recipesTable,
  //     Item: {
  //       Name: name,
  //       UserId: userId,
  //       Location: location,
  //       IsQuick: isQuick
  //     }
  //   };
  //
  //   const checkIfRecipeExistsParams = {
  //     TableName: recipesTable,
  //     Key: {
  //       Name: name,
  //       UserId: userId
  //     }
  //   };
  //
  //   console.log('Attempting to add recipe', dynamoParams);
  //
  //   // query DynamoDB to see if the item exists first
  //   dbGet(checkIfRecipeExistsParams)
  //     .then(data => {
  //       console.log('Get item succeeded', data);
  //
  //       const recipe = data.Item;
  //
  //       if (recipe) {
  //         const errorMsg = `Recipe ${name} already exists!`;
  //         this.emit(':tell', errorMsg);
  //         throw new Error(errorMsg);
  //       }
  //       else {
  //         // no match, add the recipe
  //         return dbPut(dynamoParams);
  //       }
  //     })
  //     .then(data => {
  //       console.log('Add item succeeded', data);
  //
  //       this.emit(':tell', `Recipe ${name} added!`);
  //     })
  //     .catch(err => {
  //       console.error(err);
  //     });
  // },
  //
  // /**
  //  * Lists all saved recipes for the current user. The user can filter by quick or long recipes.
  //  * Slots: GetRecipeQuickOrLong
  //  */
  // 'GetAllRecipesIntent'() {
  //   const { userId } = this.event.session.user;
  //   const { slots } = this.event.request.intent;
  //   let output;
  //
  //   // prompt for slot data if needed
  //   if (!slots.GetRecipeQuickOrLong.value) {
  //     const slotToElicit = 'GetRecipeQuickOrLong';
  //     const speechOutput = 'Would you like a quick or long recipe or do you not care?';
  //     const repromptSpeech = 'Would you like a quick or long recipe or do you not care?';
  //     return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
  //   }
  //
  //   const isQuick = slots.GetRecipeQuickOrLong.value.toLowerCase() === 'quick';
  //   const isLong = slots.GetRecipeQuickOrLong.value.toLowerCase() === 'long';
  //   const dynamoParams = {
  //     TableName: recipesTable
  //   };
  //
  //   if (isQuick || isLong) {
  //     dynamoParams.FilterExpression = 'UserId = :user_id AND IsQuick = :is_quick';
  //     dynamoParams.ExpressionAttributeValues = { ':user_id': userId, ':is_quick': isQuick };
  //     output = `The following ${isQuick ? 'quick' : 'long'} recipes were found: <break strength="x-strong" />`;
  //   }
  //   else {
  //     dynamoParams.FilterExpression = 'UserId = :user_id';
  //     dynamoParams.ExpressionAttributeValues = { ':user_id': userId };
  //     output = 'The following recipes were found: <break strength="x-strong" />';
  //   }
  //
  //   // query DynamoDB
  //   dbScan(dynamoParams)
  //     .then(data => {
  //       console.log('Read table succeeded!', data);
  //
  //       if (data.Items && data.Items.length) {
  //         data.Items.forEach(item => { output += `${item.Name}<break strength="x-strong" />`; });
  //       }
  //       else {
  //         output = 'No recipes found!';
  //       }
  //
  //       console.log('output', output);
  //
  //       this.emit(':tell', output);
  //     })
  //     .catch(err => {
  //       console.error(err);
  //     });
  // },
  //
  // /**
  //  * Reads the full info of the selected recipe.
  //  * Slots: RecipeName
  //  */
  // 'GetRecipeIntent'() {
  //   const { slots } = this.event.request.intent;
  //
  //   // prompt for slot data if needed
  //   if (!slots.RecipeName.value) {
  //     const slotToElicit = 'RecipeName';
  //     const speechOutput = 'What is the name of the recipe?';
  //     const repromptSpeech = 'Please tell me the name of the recipe';
  //     return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
  //   }
  //
  //   const { userId } = this.event.session.user;
  //   const recipeName = slots.RecipeName.value;
  //   const dynamoParams = {
  //     TableName: recipesTable,
  //     Key: {
  //       Name: recipeName,
  //       UserId: userId
  //     }
  //   };
  //
  //   console.log('Attempting to read data');
  //
  //   // query DynamoDB
  //   dbGet(dynamoParams)
  //     .then(data => {
  //       console.log('Get item succeeded', data);
  //
  //       const recipe = data.Item;
  //
  //       if (recipe) {
  //         this.emit(':tell', `Recipe ${recipeName} is located in ${recipe.Location} and it
  //                       is a ${recipe.IsQuick ? 'Quick' : 'Long'} recipe to make.`);
  //       }
  //       else {
  //         this.emit(':tell', `Recipe ${recipeName} not found!`);
  //       }
  //     })
  //     .catch(err => console.error(err));
  // },
  //
  // /**
  //  * Gets a random saved recipe for this user. The user can filter by quick or long recipes.
  //  * Slots: GetRecipeQuickOrLong
  //  */
  // 'GetRandomRecipeIntent'() {
  //   const { slots } = this.event.request.intent;
  //
  //   // prompt for slot data if needed
  //   if (!slots.GetRecipeQuickOrLong.value) {
  //     const slotToElicit = 'GetRecipeQuickOrLong';
  //     const speechOutput = 'Would you like a quick or long recipe or do you not care?';
  //     const repromptSpeech = 'I said, would you like a quick or long recipe or do you not care?';
  //     return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
  //   }
  //
  //   const quickOrLongSlotValue = slots.GetRecipeQuickOrLong.value.toLowerCase();
  //   const isQuick = quickOrLongSlotValue === 'quick';
  //   const isLong = quickOrLongSlotValue === 'long';
  //   const { userId } = this.event.session.user;
  //   const dynamoParams = {
  //     TableName: recipesTable,
  //     FilterExpression: 'UserId = :user_id',
  //     ExpressionAttributeValues: { ':user_id': userId }
  //   };
  //
  //   if (isQuick || isLong) {
  //     dynamoParams.FilterExpression += ' AND IsQuick = :is_quick';
  //     dynamoParams.ExpressionAttributeValues[':is_quick'] = isQuick;
  //   }
  //
  //   console.log('Attempting to read data');
  //
  //   // query DynamoDB
  //   dbScan(dynamoParams)
  //     .then(data => {
  //       console.log('Read table succeeded!', data);
  //
  //       const recipes = data.Items;
  //
  //       if (!recipes.length) {
  //         this.emit(':tell', 'No recipes added.');
  //       }
  //       else {
  //         const randomNumber = Math.floor(Math.random() * recipes.length);
  //         const recipe = recipes[randomNumber];
  //
  //         this.emit(':tell', `The lucky recipe is ${recipe.Name} <break time="500ms"/> and it is located in ${recipe.Location} and it is a ${recipe.IsQuick ? 'quick' : 'long'} recipe to make.`);
  //       }
  //     })
  //     .catch(err => console.error(err));
  // },
  //
  // /**
  //  * Allow the user to delete one of their recipes.
  //  */
  // 'DeleteRecipeIntent'() {
  //   const { slots } = this.event.request.intent;
  //
  //   // prompt for the recipe name if needed and then require a confirmation
  //   if (!slots.RecipeName.value) {
  //     const slotToElicit = 'RecipeName';
  //     const speechOutput = 'What is the name of the recipe you would like to delete?';
  //     const repromptSpeech = 'Please tell me the name of the recipe';
  //     return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
  //   }
  //   else if (slots.RecipeName.confirmationStatus !== 'CONFIRMED') {
  //
  //     if (slots.RecipeName.confirmationStatus !== 'DENIED') {
  //       // slot status: unconfirmed
  //       const slotToConfirm = 'RecipeName';
  //       const speechOutput = `You would like to delete the recipe ${slots.RecipeName.value}, correct?`;
  //       const repromptSpeech = speechOutput;
  //       return this.emit(':confirmSlot', slotToConfirm, speechOutput, repromptSpeech);
  //     }
  //
  //     // slot status: denied -> reprompt for slot data
  //     const slotToElicit = 'RecipeName';
  //     const speechOutput = 'What is the name of the recipe you would like to delete?';
  //     const repromptSpeech = 'Please tell me the name of the recipe';
  //     return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
  //   }
  //
  //   const { userId } = this.event.session.user;
  //   const recipeName = slots.RecipeName.value;
  //   const dynamoParams = {
  //     TableName: recipesTable,
  //     Key: {
  //       Name: recipeName,
  //       UserId: userId
  //     }
  //   };
  //
  //   console.log('Attempting to read data');
  //
  //   // query DynamoDB to see if the item exists first
  //   dbGet(dynamoParams)
  //     .then(data => {
  //       console.log('Get item succeeded', data);
  //
  //       const recipe = data.Item;
  //
  //       if (recipe) {
  //         console.log('Attempting to delete data', data);
  //
  //         return dbDelete(dynamoParams);
  //       }
  //
  //       const errorMsg = `Recipe ${recipeName} not found!`;
  //       this.emit(':tell', errorMsg);
  //       throw new Error(errorMsg);
  //     })
  //     .then(data => {
  //       console.log('Delete item succeeded', data);
  //
  //       this.emit(':tell', `Recipe ${recipeName} deleted!`);
  //     })
  //     .catch(err => console.log(err));
  // },

  'Unhandled'() {
    console.error('problem', this.event);
    this.emit(':ask', 'An unhandled problem occurred!');
  },

  'AMAZON.HelpIntent'() {
    const speechOutput = instructions;
    const reprompt = instructions;
    this.emit(':ask', speechOutput, reprompt);
  },

  'AMAZON.CancelIntent'() {
    this.emit(':tell', 'Goodbye!');
  },

  'AMAZON.StopIntent'() {
    this.emit(':tell', 'Goodbye!');
  }
};

exports.handler = function handler(event, context) {
  const alexa = alexaSDK.handler(event, context);
  // alexa.APP_ID = appId;
  alexa.appId = appId;
  alexa.registerHandlers(handlers);
  alexa.execute();
};
