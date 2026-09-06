import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITestCase {
    id: string;
    input: string;
    output: string;
    isHidden: boolean;
    explanation?: string | null;
}

export interface IProblem extends Document {
    id: string; // We'll keep the custom string ID or use _id
    title: string;
    description: string;
    difficulty: "Easy" | "Medium" | "Hard";
    type: "coding" | "general";
    slug: string;
    defaultCode?: Record<string, string>;
    functionName?: string;
    args?: string[];
    testCases?: ITestCase[];
    tags: string[];
    companies?: string[];
    constraints?: string[];
    createdAt: Date;
    updatedAt: Date;
    userId: string;
}

const TestCaseSchema = new Schema<ITestCase>({
    id: { type: String, required: true },
    input: { type: String, required: true },
    output: { type: String, required: true },
    isHidden: { type: Boolean, default: false },
    explanation: { type: String, required: false },
}, { _id: false });

const ProblemSchema = new Schema<IProblem>(
    {
        userId: { type: String, required: true },
        title: { type: String, required: true },
        description: { type: String, required: true },
        difficulty: {
            type: String,
            enum: ["Easy", "Medium", "Hard"],
            required: true,
        },
        type: { type: String, enum: ["coding", "general"], required: true },
        slug: { type: String, required: true, unique: true },
        defaultCode: { type: Map, of: String },
        functionName: { type: String },
        args: { type: [String] },
        testCases: { type: [TestCaseSchema], default: [] },
        tags: { type: [String], default: [] },
        companies: { type: [String], default: [] },
        constraints: { type: [String], default: [] },
    },
    {
        timestamps: true,
        toJSON: {
            virtuals: true,
            transform: function (_doc, ret: any) {
                ret.id = ret._id ? ret._id.toString() : ret.id;
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
        toObject: { virtuals: true },
    }
);

// Prevent overwriting model if already compiled
const Problem: Model<IProblem> =
    mongoose.models.Problem || mongoose.model<IProblem>("Problem", ProblemSchema);

export default Problem;
