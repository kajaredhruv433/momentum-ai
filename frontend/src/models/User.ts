import mongoose from 'mongoose';

export interface IUser extends mongoose.Document {
    firebaseUid: string;
    email: string;
    name: string;
    role: 'user' | 'recruiter';
    companyName?: string;
    createdAt: Date;
}

const UserSchema = new mongoose.Schema<IUser>({
    firebaseUid: {
        type: String,
        required: [true, 'Please provide a firebaseUid for this user.'],
        unique: true,
    },
    email: {
        type: String,
        required: [true, 'Please provide an email for this user.'],
        unique: true,
    },
    name: {
        type: String,
        required: [true, 'Please provide a name for this user.'],
    },
    role: {
        type: String,
        enum: ['user', 'recruiter'],
        default: 'user',
    },
    companyName: {
        type: String,
        required: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
