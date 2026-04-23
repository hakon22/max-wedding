/**
 * English UI strings (same shape as ru for i18next resources)
 */
const enResources = {
  translation: {
    weddingLanding: {
      ui: {
        language: 'Interface language',
      },
      fontPreview: {
        headingsLabel: 'Headings',
        bodyLabel: 'Body text (paragraphs, form)',
        fonts: {
          cormorant: 'Cormorant Garamond — soft classic (current)',
          playfair: 'Playfair Display — high-contrast editorial',
          ebGaramond: 'EB Garamond — bookish elegance',
          spectral: 'Spectral — calm modern serif',
          philosopher: 'Philosopher — distinctive characterful serif',
        },
        bodyFonts: {
          geist: 'Geist — current neutral base',
          merriweather: 'Merriweather — warm readable serif',
          nunitoSans: 'Nunito Sans — soft rounded sans',
          comfortaa: 'Comfortaa — rounded "candy" sans',
          neucha: 'Neucha — airy informal hand-drawn outline',
        },
      },
      hero: {
        nameLine1: 'Maxim',
        nameLine2: 'Darya',
        dateLabel: '23 August 2026',
      },
      sections: {
        invitation: 'Invitation',
        venue: 'Venue',
        overnight: 'Staying overnight',
        timing: 'Schedule',
        dressCode: 'Dress code',
        wishes: 'A few wishes',
        form: 'Guest form',
        video: 'See you soon',
      },
      intro:
        'Our wedding day is coming soon, and we would be delighted if you could celebrate this special day with us!',
      venue: {
        cardHeading: 'Our wedding will take place at «Bereg Zhelaniy» (Wish Shore)',
        addressLine1: 'Moscow region, Solnechnogorsk urban district, Shevlino village',
        addressLine2: 'Guest gathering at 2:00 p.m.',
        mapEmbedTitle: 'Map: directions to Bereg Zhelaniy',
      },
      overnightNote:
        'If you would like to stay overnight after the celebration, we will be happy to help you book a room. Please let us know by the end of May.',
      timing: [
        { time: '14:00', label: 'Guest arrival' },
        { time: '16:00', label: 'Registration ceremony' },
        { time: '17:00', label: 'Banquet' },
        { time: '23:00', label: 'End of the evening' },
      ],
      dressCode: {
        intro:
          'Below is a suggested colour mood for your outfit: the brush shapes suggest the tones we would love guests to echo — not literal paint or a strict Pantone match. Choose similar shades in a dress, a suit, a jacket, or accessories in whatever way feels comfortable for you. We plan to add full outfit examples for men and women as separate photos later.',
        paletteNote:
          'Main tones are warm natural and accent shades; readability and your comfort matter most.',
      },
      wishesSlides: [
        {
          title: 'No «Gorko» toast',
          body: 'We would be grateful if you refrained from shouting «Gorko» (the traditional «bitter» toast). A kiss is an expression of feelings and cannot be «ordered on demand».',
        },
        {
          title: 'About flowers',
          body: 'Please do not give us flowers on the wedding day — we leave for our honeymoon right after the celebration. If you still wish to treat us to flowers, a bouquet via a flower subscription is a lovely option we can enjoy after we return.',
        },
        {
          title: 'Gifts',
          body: 'If you would like to give us something valuable and useful, we would be very grateful for a contribution to our young family’s budget.',
        },
      ],
      formDeadlineLabel: 'Please confirm attendance and complete the form by 31 May 2026.',
      form: {
        guestNameLabel: 'Your name',
        guestNamePlaceholder: 'First and last name',
        plansToAttendLabel: 'Do you plan to attend',
        plansToAttendYes: 'Yes, I will',
        plansToAttendNo: 'No, I cannot',
        plansToAttendRequired: 'Please choose an option',
        mainCourseLabel: 'Main course',
        mainCoursePlaceholder: 'Choose',
        drinkCodesLabel: 'Drinks (multiple choice)',
        drinkCodesPlaceholder: 'Select options',
        withChildren: 'I will bring children',
        needsOvernightStay: 'I need overnight accommodation after the event',
        messageLabel: 'Comment (optional)',
        messagePlaceholder: 'Allergies, requests…',
        messageIfAbsentLabel: 'Comment (optional)',
        messageIfAbsentPlaceholder: 'A short note is welcome if you like…',
        submit: 'Submit',
        submitSuccess: 'Thank you, your answers have been saved!',
        submitError: 'Could not submit',
        validation: {
          checkFields: 'Please check the form fields',
          guestNameMin: 'At least 2 characters',
          guestNameRequired: 'Please enter your first and last name',
          plansToAttend: 'Please say whether you plan to attend',
          mainCourseRequired: 'Please select a main course',
          drinksMin: 'Select at least one drink option',
          drinkInvalid: 'Invalid drink',
          messageMax: 'At most 500 characters',
          invalidValue: 'Invalid value',
          drinksWhenNotAttending: 'Drinks are not filled in if you are not coming',
        },
      },
      video: {
        lead: 'A short video with us — looking forward to seeing you at the celebration!',
        overlay: {
          top: 'See you soon!',
          withLove: 'With love,',
          nameFirst: 'Darya',
          conjunction: 'and',
          nameSecond: 'Maxim',
        },
      },
      calendar: {
        weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        monthNames: [
          'January',
          'February',
          'March',
          'April',
          'May',
          'June',
          'July',
          'August',
          'September',
          'October',
          'November',
          'December',
        ],
      },
    },
  },
};

export default enResources;
