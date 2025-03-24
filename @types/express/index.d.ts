export * from "express-serve-static-core";

declare module "express-serve-static-core" {
  namespace Express {
    interface Request {
      user: {
        id: string;
        _id: Schema.Types.ObjectId;
        firstName: string;
        lastName: string;
        birthDate: Date;
        phoneNumber: string;
        email: string;
        address: string;
        city: string;
        postalCode: string;
        country: string;
        password: string;
        role: string[];
        canInvoice: Boolean;
        taxNo: string;
        invoiceNickname: string;
        unusedTickets: Schema.Types.ObjectId[] | undefined;
        usedTickets: Schema.Types.ObjectId[] | undefined;
        visits: Schema.Types.ObjectId[] | undefined;
        company: Schema.Types.ObjectId | undefined;
        agreesToTerms: Boolean;
        signedForNewsletter: Boolean;
        parentOf: {
          child: Schema.Types.ObjectId;
          agreesToTerms: boolean;
          signedAt: Date;
        }[];
        parentContact: { phoneNumber: string; email: string } | undefined;
        childActivationCode: { code: string; signedAt: Date } | undefined;
        createdAt: Date;
        updatedAt: Date;
        passwordChangedAt: Date;
        correctPassword: Function;
      };
    }
  }
}
