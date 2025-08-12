import { Document, Model } from 'mongoose';
export interface IUser extends Document {
    telegramId: number;
    username?: string;
    phoneNumber?: string | undefined;
    createdAt: Date;
    updatedAt: Date;
    toSafeObject(): any;
}
export interface IUserModel extends Model<IUser> {
    findByTelegramId(telegramId: number): Promise<IUser | null>;
    findByPhoneNumber(phoneNumber: string): Promise<IUser | null>;
}
export declare const User: IUserModel;
//# sourceMappingURL=User.d.ts.map