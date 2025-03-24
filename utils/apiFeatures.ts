class APIFeatures {
  query: any;
  queryString: any;

  constructor(query: any, queryString: any) {
    this.query = query;
    this.queryString = queryString;
  }

  generateFlexibleRegex(str: string): string {
    return str
      .toLowerCase()
      .replace(/č|ć|c/g, "[čćc]")
      .replace(/š/g, "[šs]")
      .replace(/ž/g, "[žz]");
  }

  filter() {
    const queryObj = { ...this.queryString };
    const exlcludedFields = ["page", "sort", "limit", "fields"];
    exlcludedFields.forEach((el) => delete queryObj[el]);

    if (queryObj.lastName) {
      const flexibleRegex = this.generateFlexibleRegex(queryObj.lastName);
      console.log(flexibleRegex);
      queryObj.lastName = { $regex: flexibleRegex, $options: "i" };
    }

    if (queryObj.date) {
      Object.keys(queryObj.date).forEach((key) => {
        queryObj.date[`${key}`] = new Date(queryObj.date[key]);
      });
    }

    if (queryObj.invoiceDate) {
      Object.keys(queryObj.invoiceDate).forEach((key) => {
        queryObj.invoiceDate[`${key}`] = new Date(queryObj.invoiceDate[key]);
      });
    }

    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

    this.query = this.query.find(JSON.parse(queryStr));

    return this;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(",").join(" ");
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort("_id");
    }

    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(",").join(" ");
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select("-__v");
    }
    return this;
  }

  paginate() {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 100;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);

    return this;
  }
}

export default APIFeatures;
