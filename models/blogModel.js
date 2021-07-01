const mongoose = require('mongoose');
const generateSlug = require('../utils/generateSlug');
const User = require('./userModel');
// const validator = require('validator');

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'A post must have a title'],
      trim: true,
      maxlength: [50, 'A post title must not exceed 50 characters'],
      // validate: [validator.isAlpha, 'Tour name must only contain characters']
    },
    upvotes: {
      type: Number,
      default: 0,
    },
    tags: String,
    slug: {
      type: String,
      unique: true,
    },
    text: {
      type: String,
      trim: true,
      required: [true, 'A blog must have a description'],
    },
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false,
    },
    changedAt: {
      type: Date,
      default: Date.now(),
      select: false,
    },
    blogStatus: {
      type: String,
      enum: {
        values: ['open', 'close'],
        message: 'Choose only open or close',
      },
      default: 'open',
    },
    blogType: {
      type: String,
      enum: {
        values: ['complaint', 'article'],
        message: 'Choose either complaint or article',
      },
      required: [true, 'Blog must be a complaint or an article'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'A blog must belong to a user!'],
    },
    userId: {
      type: mongoose.Schema.ObjectId,
      reg: 'User',
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// INDEXING
blogSchema.index({ title: 1, text: 1 });

// DEFINING VIRTUAL properties
// blogSchema.virtual('durationWeeks').get(function () {
//   return this.duration / 7;
// });

// Virtual populate
// TODO after completing comment model then come here and uncomment below code.
// blogSchema.virtual('comments', {
//   ref: 'Comment',
//   foreignField: 'blog',
//   localField: '_id',
// });

// DOCUMENT MIDDLEWARE: runs before .save() and .create()
blogSchema.pre('save', function (next) {
  if (this.isNew) {
    this.slug = generateSlug();
    this.userId = this.user;
  }
  next();
});

// QUERY MIDDLEWARE
blogSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'user',
    select: 'name photo rollNumber',
  });

  next();
});

blogSchema.statics.calcNumberOfPosts = async function (postId) {
  const { userId } = await this.findById(postId);
  const stats = await this.aggregate([
    {
      $match: { userId, blogType: 'article' },
    },
    {
      $group: {
        _id: '$id',
        nUpvotes: { $sum: 1 },
      },
    },
  ]);
  // console.log(stats);

  if (stats.length > 0) {
    await User.findByIdAndUpdate(userId, {
      numberOfPosts: stats[0].nUpvotes,
    });
  } else {
    await User.findByIdAndUpdate(userId, {
      numberOfPosts: 0,
    });
  }
};

blogSchema.statics.calcNumberOfComplaints = async function (postId) {
  const { userId } = await this.findById(postId);
  const stats = await this.aggregate([
    {
      $match: { userId, blogType: 'complaint' },
    },
    {
      $group: {
        _id: '$id',
        nUpvotes: { $sum: 1 },
      },
    },
  ]);
  // console.log(stats);

  if (stats.length > 0) {
    await User.findByIdAndUpdate(userId, {
      numberOfComplaints: stats[0].nUpvotes,
    });
  } else {
    await User.findByIdAndUpdate(userId, {
      numberOfComplaints: 0,
    });
  }
};

blogSchema.post('save', function () {
  if (this.blogType === 'article') this.constructor.calcNumberOfPosts(this.id);
  else this.constructor.calcNumberOfComplaints(this.id);
});

const Blog = mongoose.model('Blog', blogSchema);

module.exports = Blog;
