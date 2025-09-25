import { Attributes, Schema } from "@sailpoint/connector-sdk"

// export class Account {
//     nativeIdentity: string
//     name: string
//     attributes: Attributes

//     constructor(account: Account, schema: Schema) {
//         this.nativeIdentity = account.nativeIdentity
//         this.name = account.name
//         this.attributes = account.attributes
//     }
// }

export interface Account {
    nativeIdentity?: string
    identity: string
    name: string
    attributes: Attributes
}