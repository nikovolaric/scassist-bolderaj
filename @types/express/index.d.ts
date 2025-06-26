export * from "express-serve-static-core";

declare module "express-serve-static-core" {
  namespace Express {
    interface Request {
      user: {
        id: string;
        _id: Schema.Types.ObjectId;
        firstName: string;
        lastName: string;
        fullName: string;
        birthDate: Date;
        phoneNumber: string;
        email: string;
        address: string;
        city: string;
        postalCode: string;
        country: string;
        password: string;
        role: string[];
        age: number;
        ageGroup: string[];
        canInvoice: Boolean;
        taxNo: string | undefined;
        invoiceNickname: string | undefined;
        unusedTickets: Schema.Types.ObjectId[] | undefined;
        company: Schema.Types.ObjectId | undefined;
        agreesToTerms: Boolean;
        infoIsTrue: Boolean;
        signedForNewsletter: Boolean;
        parentOf: {
          child: Schema.Types.ObjectId;
          agreesToTerms: boolean;
          infoIsTrue: boolean;
          signedAt: Date;
        }[];
        parentContact: { phoneNumber: string; email: string } | undefined;
        childActivationCode: { code: string; signedAt: Date } | undefined;
        createdAt: Date;
        updatedAt: Date;
        passwordChangedAt: Date;
        correctPassword: Function;
        additionalInfo: string;
      };
      cashRegister: {
        user: Schema.Types.ObjectId;
        loginTime: Date;
        startCashBalance: number;
        startCreditCardBalance: number;
        endCashBalance: number;
        endCreditCardBalance: number;
        logoutTime: Date;
        cashBalanceDifference: number;
        creditCardBalanceDifference: number;
      };
    }
  }
}
