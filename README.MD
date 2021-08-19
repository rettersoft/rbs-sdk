### Installation

`npm install @rettersoft/rbs-sdk`

### Usage

RBS JS SDK can be used in two types of clients:

1. User Apps: A user app can be any web app for different end user types like: end users, admin users, reporting users etc. 
2. Services: A service is a RBS service which sends actions to RBS Core service. 

### User initialization

Client can be initialized with a project id. **Project ID** can is a unique id of a project created in RBS developer console.

```
const rbs = RBS.getInstance({
  projectId: '{PROJECT_ID}'
})
```

### Service initialization

```
const rbs = RBS.getInstance({
    projectId: request.projectId,
    developerId: 'rbs',
    serviceId: 'pm',
    secretKey: process.env.RBS_SECRET_KEY,
    region: RbsRegion.euWest1Beta,
}, true) // return new instance or cached instance
```

**Developer Id**: The id of the developer registered in RBS developer console.

**Service Id**: The id of the service this developer has registered in RBS developer console.

**Secret Key**: The secret key generated for this service in RBS developer console.

### Rbs Url

Base RBS url for the SDK to connect to. For apps which live in RBS Cloud, this parameter should not be given. 

```
const rbs = new RBS({
    projectId: "{PROJECT_ID}",
    rbsUrl: "https://core.rettermobile.com" // Default value
})
```

### Example Action Call

```
let result = await rbs.send({
    action: 'rbs.someservice.request.SOME_ACTION',
    data: {
        "a": "1"
    }
})
```

### Authenticate with custom token
```
let authResult = await rbs.authenticateWithCustomToken("{A_CUSTOM_TOKEN}")
```


### Auth State Change Listener

```
rbs.authStatus.subscribe((event:RBSAuthChangedEvent) => {

})
```

Models:

```
export enum RBSAuthStatus {
    SIGNED_IN = "SIGNED_IN",
    SIGNED_IN_ANONYM = "SIGNED_IN_ANONYM",
    SIGNED_OUT = "SIGNED_OUT",
    AUTH_FAILED = "AUTH_FAILED"
}

export interface RBSAuthChangedEvent {
    authStatus: RBSAuthStatus
    identity?: string
    uid?: string
    message?: string
}
```


