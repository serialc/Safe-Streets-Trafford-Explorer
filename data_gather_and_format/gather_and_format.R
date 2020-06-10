# main data source: https://safestreetstrafford.commonplace.is/comments
# map of bounds source: https://safestreetstrafford.commonplace.is/content/map.json

library(rjson)
#library(RCurl)

cmnts_url <- "https://safestreetstrafford.commonplace.is/comments.json"
json_file <- paste0("data/SST_cmnts_", Sys.Date(), ".json")
# download and save with today's date
download.file(cmnts_url, json_file)

# import to R, convert from JSON
cmnts <- rjson::fromJSON(file = json_file)

# fields of interest
foi <- list(issue_tags="whatIsTheIssueYouAreCommentingOn",
         solution_tags="whatCouldWeHelpToPromoteSafePhysicalDistancingHere",
         want_perm="wouldYouLikeToSeeTheseTemporaryChangesMadePermanent",
         comment="anyOtherComments",
         short_desc="whatItIs")

cmnts_clean <- lapply(cmnts, function(x) {
  # x <- cmnts[[6]]
  cid <- x$id
  feeling <- x$properties$feeling # 0,25, 50, 75, or 100
  consent <- x$properties$consent
  if( is.null(consent)) { consent <- NA}
  subdate <- x$properties$date
  votes <- x$properties$agree$number
  url <- strsplit(x = x$shortUrl, split = "[?]")[[1]][1]
  wgs_lat <- x$geometry$coordinates[2]
  wgs_long <- x$geometry$coordinates[1]
  
  # look for each of the fields of interest, foi
  xfoi <- sapply(foi, function(y) {
    # y <- foi[[2]]
    tmp <- sapply(x$properties$fields, function(z) {
      # z <- x$properties$fields[[1]]
      if( y != z$name ) {
        return(NA)
      }
      return(paste(z$value, collapse = "_,_"))
    })
  })
  
  # fields of interest results
  xfoir <- data.frame(t(apply(xfoi, MARGIN = 2, function(x) {
    if(all(is.na(x))) { return(NA)}
    x[!is.na(x)][[1]]
  })), stringsAsFactors = F)

  title <- xfoir$short_desc
  perm <- xfoir$want_perm
  comment <- gsub(pattern = "\n", replacement = "<br>", x = xfoir$comment)
  issues_csv <- xfoir$issue_tags
  suggest_csv <- xfoir$solution_tags
  
  return(data.frame(title=title,
                    cid=cid,
                    feeling=feeling,
                    consent=consent,
                    subdate=subdate,
                    votes=votes,
                    url=url,
                    lat=wgs_lat,
                    long=wgs_long,
                    wantperm=perm,
                    issues=issues_csv,
                    solutions=suggest_csv,
                    comment=comment,
                    stringsAsFactors = F))
})

sst <- do.call('rbind', cmnts_clean)

# fix dates from relative to absolute
now <- Sys.time()
sst$abdate <- NA
dt_in_days_ago <- grep(pattern="days", sst$subdate)
dt_a_day_ago <- grep(pattern="a day", sst$subdate)
dt_in_hours_ago <- grepl(pattern="hours", sst$subdate)
dt_an_hour_ago <- grepl(pattern="an hour", sst$subdate)
dt_in_mins_ago <- grepl(pattern="minutes", sst$subdate)

sst$abdate[dt_in_days_ago] <- strftime(now - (as.integer(unlist(strsplit(x = sst[dt_in_days_ago,"subdate"], split = " days ago"))) * 60 * 60 * 24), "%Y-%m-%d")
sst$abdate[dt_a_day_ago] <- strftime(now - (60 * 60 * 24), "%Y-%m-%d")
sst$abdate[dt_in_hours_ago] <- strftime(now - (as.integer(unlist(strsplit(x = sst[dt_in_hours_ago,"subdate"], split = " hours ago"))) * 60 * 60), "%Y-%m-%d")
sst$abdate[dt_an_hour_ago] <- strftime(now - (60 * 60), "%Y-%m-%d")
sst$abdate[dt_in_mins_ago] <- strftime(now - (as.integer(unlist(strsplit(x = sst[dt_in_mins_ago,"subdate"], split = " minutes ago"))) * 60), "%Y-%m-%d")

# check
any(is.na(sst$abdate))
sst$subdate[is.na(sst$abdate)]

# filter out bad data
sst <- sst[sst$lat < 53.50,]

# replace bit.ly urls with proper
base_url <- "https://safestreetstrafford.commonplace.is/comments/"
sst$url <- paste0(base_url, sst$cid)

# export
#write.table(sst, file = 'www/data/data.tsv', quote = F, sep = "\t", row.names = F)
write(toJSON(split(sst, 1:nrow(sst))), '../data/cmnts.json')
